from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import get_current_user, hash_password, new_token, verify_password
from ..db import get_db
from ..models import User
from ..schemas import LoginIn, RegisterIn

router = APIRouter(prefix="/auth", tags=["auth"])
SELF_SERVICE_ROLES = {"Manager", "Analyst"}


def user_out(u: User) -> dict:
    return {"user_id": u.user_id, "name": u.name, "email": u.email, "role": u.role}


@router.post("/register", status_code=201)
def register(body: RegisterIn, db: Session = Depends(get_db)):
    email = body.email.strip().lower()
    if body.role not in SELF_SERVICE_ROLES:
        raise HTTPException(403, "Self-registration is limited to Manager or Analyst roles")
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(409, "An account with this email already exists")
    user = User(name=body.name.strip(), email=email, password_hash=hash_password(body.password),
                role=body.role, token=new_token())
    db.add(user); db.commit(); db.refresh(user)
    return {"token": user.token, "user": user_out(user)}


@router.post("/login")
def login(body: LoginIn, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == body.email.strip().lower()))
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(401, "Incorrect email or password")
    user.token = new_token()
    db.commit()
    return {"token": user.token, "user": user_out(user)}


@router.get("/me")
def me(user: User = Depends(get_current_user)):
    return user_out(user)


@router.post("/logout")
def logout(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    user.token = None
    db.commit()
    return {"ok": True}
