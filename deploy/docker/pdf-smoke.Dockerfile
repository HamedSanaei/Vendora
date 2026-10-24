# syntax=docker/dockerfile:1
# Build the normal API image first. This probe reuses its exact runtime, native libraries, fonts and non-root user.
ARG API_IMAGE=vendora-api-pdf-qa:local
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS probe-build
WORKDIR /src
COPY Domain/ Domain/
COPY Persistence/ Persistence/
COPY Application/ Application/
COPY Infrastructure/ Infrastructure/
COPY tests/Vendora.PdfSmoke/ tests/Vendora.PdfSmoke/
RUN dotnet publish tests/Vendora.PdfSmoke/Vendora.PdfSmoke.csproj -c Release -o /probe

FROM ${API_IMAGE}
# Only the probe executable/manifest is added. All renderer assemblies, native dependencies and fonts come from production publish.
COPY --from=probe-build /probe/Vendora.PdfSmoke.dll /probe/Vendora.PdfSmoke.deps.json /probe/Vendora.PdfSmoke.runtimeconfig.json /app/
ENTRYPOINT ["dotnet", "Vendora.PdfSmoke.dll"]
CMD ["/out"]
