import { useCallback } from "react";
import { apiClient } from "@/lib/api-client"; // ajusta el path si tu api-client vive en otra carpeta

export type ReportsFilters = {
  from?: string;
  to?: string;
  serviceId?: number;
  operatorId?: number;
  ticketNumberFrom?: number;
  ticketNumberTo?: number;
  granularity?: "hour" | "day";
  tz?: "UTC" | "America/Argentina/Mendoza";
};

export function useReports() {
  const getSummary = useCallback(async (f: ReportsFilters) => {
    return apiClient.getReportSummary(f);
  }, []);

  const getThroughput = useCallback(async (f: ReportsFilters) => {
    return apiClient.getReportThroughput(f);
  }, []);

  const exportCsv = useCallback((f: ReportsFilters) => {
    window.location.href = apiClient.exportReportsCsvUrl(f);
  }, []);

  const exportXlsx = useCallback((f: ReportsFilters) => {
    window.location.href = apiClient.exportReportsXlsxUrl(f);
  }, []);

  const createSnapshot = useCallback(async (payload: any) => {
    return apiClient.createReportSnapshot(payload);
  }, []);

  const listSnapshots = useCallback(async (f: ReportsFilters & { type?: string; limit?: number; offset?: number }) => {
    return apiClient.listReportSnapshots(f);
  }, []);

  return { getSummary, getThroughput, exportCsv, exportXlsx, createSnapshot, listSnapshots };
}
