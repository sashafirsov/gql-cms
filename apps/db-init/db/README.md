# Docker image with database And initialization scripts
This directory contains a Dockerfile to create a PostgreSQL database image with initialization scripts.

# Run
On the top project directory, run:
```bash
cd ../../.. # go to the top project directory
docker-compose build gql-cms-db # re-build only this Docker image
docker-compose build # all services

docker-compose up
```


