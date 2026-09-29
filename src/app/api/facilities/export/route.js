import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getFacilities } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const format = (searchParams.get("format") || "xlsx").toLowerCase();
    const q = searchParams.get("q") || "";
    const district = searchParams.get("district") || "all";
    const facility_type = searchParams.get("facility_type") || "all";

    const rawList = await getFacilities({ q, district, facility_type });

    const exportRows = (rawList || []).map((f) => ({
      name: f.name || "",
      facility_type: f.facility_type || "",
      scheme: f.scheme || "",
      address: f.address || "",
      district: f.district || "",
      block: f.block || "",
      pincode: f.pincode ? String(f.pincode) : "",
      state: f.state || "Assam",
      latitude: f.latitude ?? "",
      longitude: f.longitude ?? "",
      site_code: f.site_code || "",
      phone: f.phone || "",
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportRows, {
      header: [
        "name",
        "facility_type",
        "scheme",
        "address",
        "district",
        "block",
        "pincode",
        "state",
        "latitude",
        "longitude",
        "site_code",
        "phone",
      ],
    });

    worksheet["!cols"] = [
      { wch: 34 }, // name
      { wch: 18 }, // facility_type
      { wch: 10 }, // scheme
      { wch: 60 }, // address
      { wch: 22 }, // district
      { wch: 16 }, // block
      { wch: 10 }, // pincode
      { wch: 12 }, // state
      { wch: 14 }, // latitude
      { wch: 14 }, // longitude
      { wch: 14 }, // site_code
      { wch: 18 }, // phone
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Facilities Export");

    const dateStr = new Date().toISOString().slice(0, 10);

    if (format === "csv") {
      const csvContent = XLSX.utils.sheet_to_csv(worksheet);
      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="facilities_export_${dateStr}.csv"`,
        },
      });
    }

    // Default: XLSX Excel
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="facilities_export_${dateStr}.xlsx"`,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { detail: `Failed to export facilities: ${err.message}` },
      { status: 500 }
    );
  }
}
