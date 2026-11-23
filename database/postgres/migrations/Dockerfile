FROM postgres:16.4

COPY database/postgres/migrations/001_initial_schema.sql /migrations/auth/001_initial_schema.sql
COPY database/postgres/migrations/squad /migrations/squad
COPY database/postgres/migrations/event /migrations/event
COPY database/postgres/migrations/chat /migrations/chat
COPY database/postgres/migrations/run.sh /migrations/run.sh

RUN chmod 0555 /migrations/run.sh

ENTRYPOINT ["/migrations/run.sh"]
