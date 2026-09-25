import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

const sampleData = [
  {
    name: "ESIC Hospital Beltola",
    facility_type: "Hospital",
    scheme: "ESIC",
    address: "ESIC Hospital Campus, Pir Ajan Fakir Rd, near Kendriya Vidyalaya, Khanapara, Guwahati",
    district: "Kamrup Metropolitan",
    block: "Dimoria",
    pincode: "781022",
    state: "Assam",
    latitude: 26.121567,
    longitude: 91.808542,
    site_code: "AS-BEL-01",
    phone: "0361-2360050",
  },
  {
    name: "ESIS Dispensary Panbazar",
    facility_type: "Dispensary",
    scheme: "ESIS",
    address: "MG Road, Near District Library, Panbazar, Guwahati",
    district: "Kamrup Metropolitan",
    block: "Guwahati",
    pincode: "781001",
    state: "Assam",
    latitude: 26.185200,
    longitude: 91.745600,
    site_code: "AS-PAN-02",
    phone: "0361-2540120",
  },
  {
    name: "ESIS Model Dispensary Tinsukia",
    facility_type: "Dispensary",
    scheme: "ESIS",
    address: "Parbatia, PO Sukanpukhuri, Dist Tinsukia",
    district: "Tinsukia",
    block: "Itakhuli",
    pincode: "786125",
    state: "Assam",
    latitude: 27.491520,
    longitude: 95.372980,
    site_code: "AS-TIN-03",
    phone: "0374-2331450",
  },
];

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const format = (searchParams.get("format") || "xlsx").toLowerCase();

  const worksheet = XLSX.utils.json_to_sheet(sampleData, {
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

  // Set column widths for better Excel readability
  worksheet["!cols"] = [
    { wch: 32 }, // name
    { wch: 16 }, // facility_type
    { wch: 10 }, // scheme
    { wch: 55 }, // address
    { wch: 22 }, // district
    { wch: 14 }, // block
    { wch: 10 }, // pincode
    { wch: 12 }, // state
    { wch: 14 }, // latitude
    { wch: 14 }, // longitude
    { wch: 14 }, // site_code
    { wch: 16 }, // phone
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Facilities Template");

  if (format === "csv") {
    const csvContent = XLSX.utils.sheet_to_csv(worksheet);
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="facilities_sample_template.csv"',
      },
    });
  }

  // Default: XLSX
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="facilities_sample_template.xlsx"',
    },
  });
}
