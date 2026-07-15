from typing import Any

from pydantic import BaseModel, ConfigDict


class PageSettingRead(BaseModel):
    page_key: str
    settings: dict[str, Any]

    model_config = ConfigDict(from_attributes=True)


class PageSettingWrite(BaseModel):
    settings: dict[str, Any]
