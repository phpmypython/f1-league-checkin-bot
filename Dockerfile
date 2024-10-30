FROM --platform=linux/amd64 denoland/deno

EXPOSE 8000
# Dockerfile

# Set up your SQLite path if not already set
ENV DATABASE_PATH="/app/data/checkin_bot.db"



WORKDIR /app
# Create the /app/data directory
RUN mkdir -p /app/data
ADD . /app


RUN deno install --entrypoint main.ts

VOLUME ["/app/data"]

CMD ["deno","task", "start"]
