import uuid

from app.core.common import utcnow
from app.projects.project.exceptions import ProjectNotFoundError, ProjectNotOwnedError
from app.projects.project.repository import ProjectRepository
from app.projects.project.schemas import ProjectAuthorRead
from app.projects.updates.enums import (
    UpdateReferenceDisplayReason,
    UpdateReferenceReason,
)
from app.projects.updates.exceptions import (
    DuplicateUpdateReferenceError,
    InvalidUpdateReferenceError,
    ReferencedUpdateNotFoundError,
    UpdateNotFoundError,
    UpdateNotOwnedError,
)
from app.projects.updates.models import Update, UpdateReference
from app.projects.updates.repository import UpdateRepository
from app.projects.updates.schemas import (
    UpdateCreate,
    UpdateEdit,
    UpdateListOptions,
    UpdateRead,
    UpdateReferenceCreate,
    UpdateReferenceRead,
)


class UpdateService:
    def __init__(
        self,
        repository: UpdateRepository,
        project_repository: ProjectRepository,
    ):
        self._repo = repository
        self._project_repo = project_repository

    def create_project_update(
        self,
        project_id: uuid.UUID,
        author_id: uuid.UUID,
        data: UpdateCreate,
    ) -> UpdateRead:
        project = self._project_repo.get(project_id)
        if project is None:
            raise ProjectNotFoundError(project_id)
        if project.author_id != author_id:
            raise ProjectNotOwnedError(project_id)
        update = Update(
            project_id=project_id,
            author_id=author_id,
            title=data.title,
            body=data.body,
            update_type=data.type,
            public=project.public and data.public is not False,
        )
        references = self._get_referenced_updates(project_id, data.references)
        update.outgoing_references = [
            UpdateReference(
                referenced_update_id=target.id,
                reason=reason,
            )
            for target, reason in references
        ]
        row = self._repo.add(update)
        return self._to_read(row, author_id)

    def edit_project_update(
        self,
        project_id: uuid.UUID,
        update_id: uuid.UUID,
        author_id: uuid.UUID,
        data: UpdateEdit,
    ) -> UpdateRead:
        update = self._get_owned_update(project_id, update_id, author_id)
        values = data.model_dump(exclude_unset=True)
        if "references" in values:
            values.pop("references")
            references = self._get_referenced_updates(
                project_id, data.references or [], update.id
            )
            update.outgoing_references = [
                UpdateReference(
                    referenced_update_id=target.id,
                    reason=reason,
                )
                for target, reason in references
            ]
        for field, value in values.items():
            setattr(update, "update_type" if field == "type" else field, value)
        update.updated_at = utcnow()
        return self._to_read(self._repo.update(update), author_id)

    def delete_project_update(
        self,
        project_id: uuid.UUID,
        update_id: uuid.UUID,
        author_id: uuid.UUID,
    ) -> None:
        update = self._get_owned_update(project_id, update_id, author_id)
        self._repo.delete(update)

    def list_project_updates(
        self,
        project_id: uuid.UUID,
        viewer_id: uuid.UUID,
        *,
        options: UpdateListOptions,
    ) -> tuple[list[UpdateRead], int]:
        """Return one page of a project's updates and the total.

        A project the viewer may not see is reported as not found, so its
        existence isn't leaked.
        """
        project = self._project_repo.get(project_id)
        if project is None or not (
            project.public or project.author_id == viewer_id
        ):
            raise ProjectNotFoundError(project_id)

        rows, total = self._repo.list_for_project(
            project_id,
            viewer_id,
            options=options,
        )
        items = [self._to_read(row, viewer_id) for row in rows]
        return items, total

    def _get_owned_update(
        self,
        project_id: uuid.UUID,
        update_id: uuid.UUID,
        author_id: uuid.UUID,
    ) -> Update:
        update = self._repo.get(update_id)
        if update is None or update.project_id != project_id:
            raise UpdateNotFoundError(update_id)
        if update.author_id != author_id:
            raise UpdateNotOwnedError(update_id)
        return update

    def _get_referenced_updates(
        self,
        project_id: uuid.UUID,
        references: list[UpdateReferenceCreate],
        update_id: uuid.UUID | None = None,
    ) -> list[tuple[Update, UpdateReferenceReason]]:
        reference_ids = [reference.target_update_id for reference in references]
        seen_ids: set[uuid.UUID] = set()
        for reference_id in reference_ids:
            if reference_id in seen_ids:
                raise DuplicateUpdateReferenceError(reference_id)
            seen_ids.add(reference_id)
            if reference_id == update_id:
                raise InvalidUpdateReferenceError(reference_id)

        updates_by_id = {
            update.id: update for update in self._repo.get_many(reference_ids)
        }
        resolved = []
        for reference in references:
            target = updates_by_id.get(reference.target_update_id)
            if target is None or target.project_id != project_id:
                raise ReferencedUpdateNotFoundError(reference.target_update_id)
            resolved.append((target, reference.reason))
        return resolved

    @staticmethod
    def _to_read(
        row: tuple[Update, str | None, str | None],
        viewer_id: uuid.UUID,
    ) -> UpdateRead:
        update, username, profile_picture_link = row
        outgoing_reads = [
            UpdateReferenceRead(
                update_id=reference.target.id,
                title=reference.target.title,
                type=reference.target.update_type,
                reason=reference.reason,
            )
            for reference in update.outgoing_references
            if reference.target.public or reference.target.author_id == viewer_id
        ]

        incoming_reads = [
            UpdateReferenceRead(
                update_id=reference.source.id,
                title=reference.source.title,
                type=reference.source.update_type,
                reason=UpdateService._inverse_reason(reference.reason),
            )
            for reference in update.incoming_references
            if reference.source.public or reference.source.author_id == viewer_id
        ]
        return UpdateRead(
            id=update.id,
            project_id=update.project_id,
            outgoing_references=outgoing_reads,
            incoming_references=incoming_reads,
            author_id=update.author_id,
            title=update.title,
            body=update.body,
            type=update.update_type,
            public=update.public,
            created_at=update.created_at,
            updated_at=update.updated_at,
            author=ProjectAuthorRead(
                username=username or "Unknown creator",
                profile_picture_link=profile_picture_link,
            ),
        )

    @staticmethod
    def _inverse_reason(
        reason: UpdateReferenceReason,
    ) -> UpdateReferenceDisplayReason:
        return {
            UpdateReferenceReason.SOLVES: UpdateReferenceDisplayReason.SOLVED_BY,
            UpdateReferenceReason.PARTIALLY_SOLVES: (
                UpdateReferenceDisplayReason.PARTIALLY_SOLVED_BY
            ),
            UpdateReferenceReason.RELATED_TO: UpdateReferenceDisplayReason.RELATED_TO,
        }[reason]
