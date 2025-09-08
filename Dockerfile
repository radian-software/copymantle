FROM radiansoftware/sleeping-beauty:v4.1.0 AS sleepingd

# EOL: April 2029
FROM ubuntu:24.04

RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*
RUN curl -sL https://deb.nodesource.com/setup_20.x | bash && rm -rf /var/lib/apt/lists/*
RUN apt-get update && apt-get install -y nodejs tini && rm -rf /var/lib/apt/lists/*

WORKDIR /src
COPY package.json package-lock.json /src/
RUN npm ci

COPY server.mjs /src/
COPY static/ /src/static/

ENV SLEEPING_BEAUTY_COMMAND="HOST=0.0.0.0 PORT=8081 node server.mjs"
ENV SLEEPING_BEAUTY_TIMEOUT_SECONDS=3600
ENV SLEEPING_BEAUTY_COMMAND_PORT=8081
ENV SLEEPING_BEAUTY_LISTEN_PORT=8080

COPY --from=sleepingd /sleepingd /usr/local/bin/sleepingd
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["sleepingd"]
EXPOSE 8080
