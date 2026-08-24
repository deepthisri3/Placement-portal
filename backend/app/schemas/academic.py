from pydantic import BaseModel, field_validator


class BranchCreate(BaseModel):
    name: str
    code: str

    @field_validator("name")
    @classmethod
    def name_ok(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 2:
            raise ValueError("Branch name must be at least 2 characters.")
        return v

    @field_validator("code")
    @classmethod
    def code_ok(cls, v: str) -> str:
        v = v.strip().upper()
        if len(v) < 1:
            raise ValueError("Branch code is required.")
        return v


class BranchOut(BaseModel):
    id: int
    name: str
    code: str

    class Config:
        from_attributes = True


class BatchCreate(BaseModel):
    graduation_year: int

    @field_validator("graduation_year")
    @classmethod
    def year_ok(cls, v: int) -> int:
        if v < 2000 or v > 2100:
            raise ValueError("Graduation year must be a valid year.")
        return v


class BatchOut(BaseModel):
    id: int
    graduation_year: int

    class Config:
        from_attributes = True