import uuid
from typing import cast

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.accounts.users.models import Profile, User
from app.projects.updates.enums import UpdateSort
from app.projects.updates.media.models import UpdateMedia
from app.projects.updates.models import Update, UpdateReference
from app.projects.updates.schemas import UpdateListOptions

UpdateRow = tuple[Update, str | None, str | None]


class UpdateRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def add(self, update: Update) -> UpdateRow:
        self._session.add(update)
        self._session.flush()

        row = self._session.execute(
            select(Update, User.username, Profile.profile_picture_link)
            .outerjoin(User, User.id == Update.author_id)
            .outerjoin(Profile, Profile.user_id == User.id)
            .where(Update.id == update.id)
        ).one()
        return cast(UpdateRow, row)

    def get(self, update_id: uuid.UUID) -> Update | None:
        return self._session.get(Update, update_id)

    def get_many(self, update_ids: list[uuid.UUID]) -> list[Update]:
        if not update_ids:
            return []
        return list(
            self._session.scalars(
                select(Update).where(Update.id.in_(update_ids))
            ).all()
        )

    def get_reverse_reference_source_ids(
        self,
        update_id: uuid.UUID,
        source_ids: list[uuid.UUID],
    ) -> set[uuid.UUID]:
        if not source_ids:
            return set()
        return set(
            self._session.scalars(
                select(UpdateReference.update_id).where(
                    UpdateReference.referenced_update_id == update_id,
                    UpdateReference.update_id.in_(source_ids),
                )
            ).all()
        )

    def update(self, update: Update) -> UpdateRow:
        self._session.flush()
        row = self._session.execute(
            select(Update, User.username, Profile.profile_picture_link)
            .outerjoin(User, User.id == Update.author_id)
            .outerjoin(Profile, Profile.user_id == User.id)
            .where(Update.id == update.id)
        ).one()
        return cast(UpdateRow, row)

    def delete(self, update: Update) -> None:
        self._session.delete(update)
        self._session.flush()

    def list_for_project(
        self,
        project_id: uuid.UUID,
        viewer_id: uuid.UUID,
        *,
        options: UpdateListOptions,
    ) -> tuple[list[UpdateRow], int]:
        """One page of a project's updates, sorted by date, plus the total count.

        Non-public updates are included only when the viewer is their author.
        """
        conditions = (
            Update.project_id == project_id,
            or_(Update.public.is_(True), Update.author_id == viewer_id),
        )
        if options.update_types:
            conditions += (Update.update_type.in_(options.update_types),)

        total: int = self._session.scalar(
            select(func.count()).select_from(Update).where(*conditions)
        ) or 0

        rows = self._session.execute(
            select(Update, User.username, Profile.profile_picture_link)
            .options(
                selectinload(Update.media).joinedload(UpdateMedia.file_asset),
                selectinload(Update.outgoing_references).joinedload(
                    UpdateReference.target
                ),
                selectinload(Update.incoming_references).joinedload(
                    UpdateReference.source
                ),
            )
            .outerjoin(User, User.id == Update.author_id)
            .outerjoin(Profile, Profile.user_id == User.id)
            .where(*conditions)
            # id is a tie-breaker so pagination stays stable for equal timestamps
            .order_by(
                (
                    Update.created_at.asc()
                    if options.sort == UpdateSort.DATE_ASC
                    else Update.created_at.desc()
                ),
                (
                    Update.id.asc()
                    if options.sort == UpdateSort.DATE_ASC
                    else Update.id.desc()
                ),
            )
            .limit(options.limit)
            .offset(options.offset)
        ).all()

        return cast(list[UpdateRow], list(rows)), total
