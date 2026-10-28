import uuid

from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.feed_items.feed_item.models import FeedItem
from app.accounts.users.models import Profile, User
from app.projects.project.enums import ProjectStatus
from app.projects.project.models import Category, Project, Tag
from app.projects.updates.models import Update


class ProjectRepository:
    """Data access only. Flushes but never commits (the request session does)."""

    def __init__(self, session: Session):
        self._session = session

    def get_category(self, category_id: uuid.UUID) -> Category | None:
        return self._session.get(Category, category_id)

    def list_categories(self) -> list[Category]:
        return list(self._session.scalars(select(Category).order_by(Category.name)))

    def get(self, project_id: uuid.UUID) -> Project | None:
        return self._session.get(Project, project_id)

    def list_private_drafts(self, author_id: uuid.UUID) -> list[Project]:
        statement = (
            select(Project)
            .where(
                Project.author_id == author_id,
                Project.status == ProjectStatus.DRAFT,
                Project.public.is_(False),
            )
            .order_by(Project.created_at.desc())
        )
        return list(self._session.scalars(statement))

    def list_published_by_author(self, author_id: uuid.UUID) -> list[Project]:
        statement = (
            select(Project)
            .where(
                Project.author_id == author_id,
                Project.public.is_(True),
                Project.status.in_((ProjectStatus.ACTIVE, ProjectStatus.COMPLETED)),
            )
            .order_by(Project.published_at.desc())
        )
        return list(self._session.scalars(statement))

    def get_with_author(self, project_id: uuid.UUID):
        statement = (
            select(Project, User.username, Profile.profile_picture_link)
            .outerjoin(User, User.id == Project.author_id)
            .outerjoin(Profile, Profile.user_id == User.id)
            .where(Project.id == project_id)
        )
        return self._session.execute(statement).one_or_none()

    def get_or_create_tags(self, names: list[str]) -> list[Tag]:
        if not names:
            return []
        self._session.execute(
            insert(Tag)
            .values([{"id": uuid.uuid4(), "name": n} for n in names])
            .on_conflict_do_nothing(index_elements=["name"])
        )
        result = self._session.execute(select(Tag).where(Tag.name.in_(names)))
        by_name = {tag.name: tag for tag in result.scalars()}
        return [by_name[n] for n in names]

    def add(self, project: Project) -> Project:
        self._session.add(project)
        self._session.flush()
        return project

    def update(self, project: Project) -> Project:
        self._session.flush()
        return project

    def delete(self, project: Project) -> None:
        update_ids = select(Update.id).where(Update.project_id == project.id)
        self._session.execute(
            delete(FeedItem).where(FeedItem.id.in_(update_ids)),
            execution_options={"synchronize_session": "fetch"},
        )
        self._session.delete(project)
        self._session.flush()
