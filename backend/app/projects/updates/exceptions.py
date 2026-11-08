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


class ProblemNotFoundError(Exception):
    def __init__(self, problem_id: uuid.UUID):
        super().__init__(f"Problem {problem_id} does not exist")
        self.problem_id = problem_id


class ProblemLinkRequiredError(Exception):
    pass


class InvalidProblemLinkError(Exception):
    def __init__(self, update_id: uuid.UUID):
        super().__init__(f"Update {update_id} is not a problem")
        self.update_id = update_id
