"""Email + password accounts with stateless JWT bearer tokens."""

from datetime import timedelta
from typing import Optional

import bcrypt
import jwt
from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, EmailStr, Field
from pymongo.errors import DuplicateKeyError

from . import config, db

router = APIRouter(prefix="/auth", tags=["auth"])


class SignupIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    name: str = Field(default="", max_length=80)


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


def public_user(user: dict) -> dict:
    return {"id": user["_id"], "email": user["email"], "name": user.get("name") or ""}


def issue_token(user_id: str) -> str:
    payload = {"sub": user_id, "iat": db.now(), "exp": db.now() + timedelta(days=config.JWT_TTL_DAYS)}
    return jwt.encode(payload, config.JWT_SECRET, algorithm="HS256")


async def optional_user(authorization: Optional[str] = Header(default=None)) -> Optional[dict]:
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    token = authorization.split(" ", 1)[1].strip()
    try:
        payload = jwt.decode(token, config.JWT_SECRET, algorithms=["HS256"])
    except jwt.PyJWTError:
        return None
    return await db.users.find_one({"_id": payload.get("sub")})


async def current_user(user: Optional[dict] = Depends(optional_user)) -> dict:
    if not user:
        raise HTTPException(status_code=401, detail="Sign in to continue.")
    return user


@router.post("/signup")
async def signup(body: SignupIn):
    email = body.email.lower()
    hashed = bcrypt.hashpw(body.password.encode(), bcrypt.gensalt()).decode()
    user = {
        "_id": db.new_id(),
        "email": email,
        "name": body.name.strip() or email.split("@")[0],
        "password_hash": hashed,
        "created_at": db.now(),
    }
    try:
        await db.users.insert_one(user)
    except DuplicateKeyError:
        raise HTTPException(status_code=409, detail="An account with this email already exists.")
    return {"token": issue_token(user["_id"]), "user": public_user(user)}


@router.post("/login")
async def login(body: LoginIn):
    user = await db.users.find_one({"email": body.email.lower()})
    if not user or not bcrypt.checkpw(body.password.encode(), user["password_hash"].encode()):
        raise HTTPException(status_code=401, detail="Wrong email or password.")
    return {"token": issue_token(user["_id"]), "user": public_user(user)}


@router.get("/me")
async def me(user: dict = Depends(current_user)):
    return {"user": public_user(user)}
