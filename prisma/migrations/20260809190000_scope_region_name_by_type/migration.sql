DROP INDEX "Region_marketId_name_key";

CREATE UNIQUE INDEX "Region_marketId_name_type_key"
ON "Region"("marketId", "name", "type");
