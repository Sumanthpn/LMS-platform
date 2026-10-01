from app.models.common import MongoModel, PyObjectId


class Domain(MongoModel):
    name: str
    slug: str
    description: str


class Topic(MongoModel):
    domain_id: PyObjectId
    name: str
    slug: str
    description: str
    question_count: int = 0


class DomainWithTopics(Domain):
    topics: list[Topic] = []
