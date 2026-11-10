"""Domain exceptions for project updates."""

import uuid


class UpdateNotFoundError(Exception):
    def __init__(self, update_id: uuid.UUID):
        super().__init__(f"Update {update_id} does not exist")
        self.update_id = update_id


class UpdateNotOwnedError(Exception):
    def __init__(self, update_id: uuid.UUID):
        super().__init__(f"User does not own update {update_id}")
        self.update_id = update_id


class ReferencedUpdateNotFoundError(Exception):
    def __init__(self, update_id: uuid.UUID):
        super().__init__(f"Referenced update {update_id} does not exist")
        self.update_id = update_id


class InvalidUpdateReferenceError(Exception):
    def __init__(self, update_id: uuid.UUID):
        super().__init__(f"Update {update_id} cannot reference itself")
        self.update_id = update_id
