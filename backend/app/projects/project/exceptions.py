import uuid

class CategoryNotFoundError(Exception):
    def __init__(self, category_id: uuid.UUID):
        super().__init__(f"Category {category_id} does not exist")
        self.category_id = category_id