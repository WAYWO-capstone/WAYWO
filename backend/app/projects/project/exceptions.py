import uuid

class CategoryNotFoundError(Exception):
    def __init__(self, category_id: uuid.UUID):
        super().__init__(f"Category {category_id} does not exist")
        self.category_id = category_id


class ProjectNotFoundError(Exception):
    def __init__(self, project_id: uuid.UUID):
        super().__init__(f"Project {project_id} does not exist")
        self.project_id = project_id


class ProjectNotOwnedError(Exception):
    def __init__(self, project_id: uuid.UUID):
        super().__init__(f"User does not own project {project_id}")
        self.project_id = project_id