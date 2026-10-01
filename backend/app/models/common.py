from typing import Annotated, Any

from bson import ObjectId
from pydantic import BaseModel, BeforeValidator, ConfigDict, Field


def _to_str(value: Any) -> str:
    if isinstance(value, ObjectId):
        return str(value)
    if isinstance(value, str):
        return value
    raise ValueError(f"Not a valid ObjectId: {value!r}")


# Serialises Mongo's ObjectId to a plain string in API responses.
PyObjectId = Annotated[str, BeforeValidator(_to_str)]


class MongoModel(BaseModel):
    """Base for models read out of MongoDB.

    Reads Mongo's `_id` on the way in and writes a plain `id` on the way out,
    so clients never have to deal with an underscore-prefixed key.
    """

    model_config = ConfigDict(populate_by_name=True)

    id: PyObjectId = Field(validation_alias="_id")
