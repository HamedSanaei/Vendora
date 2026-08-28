# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Build stage: restore, build, and publish the API in Release configuration.
# ---------------------------------------------------------------------------
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Restore first with only the project files so dependency layers cache well.
COPY Vendora.slnx ./
COPY API/API.csproj API/
COPY Application/Application.csproj Application/
COPY Domain/Domain.csproj Domain/
COPY Persistence/Persistence.csproj Persistence/
COPY Infrastructure/Infrastructure.csproj Infrastructure/
RUN dotnet restore API/API.csproj

# Copy the remaining sources and publish.
COPY API/ API/
COPY Application/ Application/
COPY Domain/ Domain/
COPY Persistence/ Persistence/
COPY Infrastructure/ Infrastructure/
RUN dotnet publish API/API.csproj -c Release -o /app/publish --no-restore

# ---------------------------------------------------------------------------
# Runtime stage: ASP.NET runtime image with only the published output.
# ---------------------------------------------------------------------------
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app

# curl is required by the Docker HEALTHCHECK.
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/publish .

# Runtime writes (SQLite, product uploads) go to bind-mounted volumes; prepare
# the upload directory and let the non-root app user own the app directory.
RUN mkdir -p /app/wwwroot/uploads/products \
    && chown -R app:app /app \
    && chmod -R u+rwX /app

USER app
ENV ASPNETCORE_URLS=http://+:8080 \
    ASPNETCORE_ENVIRONMENT=Production

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -fsS http://127.0.0.1:8080/healthz || exit 1

ENTRYPOINT ["dotnet", "API.dll"]
