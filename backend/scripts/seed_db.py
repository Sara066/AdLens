"""
(Re)load the database from data/*.csv.

Run from the project root:
    python -m backend.scripts.seed_db            # load only if empty
    python -m backend.scripts.seed_db --reset    # drop everything and reload
(The API also does this automatically on first start.)
"""
import sys

from backend.app.db import Base, SessionLocal, engine
from backend.app import models  # noqa: F401  (register tables)
from backend.app.seed import DEMO_USERS, seed_if_empty

if __name__ == "__main__":
    if "--reset" in sys.argv:
        Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        result = seed_if_empty(db)
    if result["data_loaded"]:
        print("Database seeded from data/*.csv")
    else:
        print("Nothing loaded (database already has data, or data/*.csv is missing - run python ml/generate_data.py)")
    print("Demo logins:")
    for _, email, pw, role in DEMO_USERS:
        print(f"  {role:8s} {email}  /  {pw}")
