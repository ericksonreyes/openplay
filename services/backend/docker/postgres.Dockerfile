FROM postgres:17-alpine

COPY docker/postgres/initdb/ /docker-entrypoint-initdb.d/
