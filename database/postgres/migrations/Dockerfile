FROM postgres:16.4

# One folder per service database: NNN_*.sql forward migrations, down/ for rollbacks.
COPY database/postgres/migrations/auth /migrations/auth
COPY database/postgres/migrations/squad /migrations/squad
COPY database/postgres/migrations/event /migrations/event
COPY database/postgres/migrations/chat /migrations/chat
COPY database/postgres/migrations/lib.sh database/postgres/migrations/run.sh database/postgres/migrations/rollback.sh /migrations/

RUN chmod 0444 /migrations/lib.sh && chmod 0555 /migrations/run.sh /migrations/rollback.sh

# Rollback: docker run --entrypoint /migrations/rollback.sh -e CONFIRM_ROLLBACK=<version> ...
ENTRYPOINT ["/migrations/run.sh"]
