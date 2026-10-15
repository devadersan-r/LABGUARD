import os
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url

database_url = os.environ.get("SUPABASE_DATABASE_URL")

if not database_url:
    raise SystemExit(
        "Set SUPABASE_DATABASE_URL in your terminal before running this test."
    )

# Accept Supabase's standard PostgreSQL URI.
if database_url.startswith("postgres://"):
    database_url = database_url.replace(
        "postgres://", "postgresql+psycopg://", 1
    )
elif database_url.startswith("postgresql://"):
    database_url = database_url.replace(
        "postgresql://", "postgresql+psycopg://", 1
    )

# Display only non-secret connection details.
url = make_url(database_url)
print("Host:", url.host)
print("Port:", url.port)
print("Database:", url.database)
print("Username:", url.username)

engine = create_engine(
    database_url,
    pool_pre_ping=True,
    connect_args={"sslmode": "require"},
)

try:
    with engine.connect() as connection:
        result = connection.execute(
            text("SELECT current_database(), current_user, version()")
        ).one()

        print("Connection successful.")
        print("Database:", result[0])
        print("Connected role:", result[1])
        print("PostgreSQL version:", result[2].split(",")[0])
finally:
    engine.dispose()
