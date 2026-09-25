import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { addFacilities } from "@/lib/db";

function getVal(row, keys) {
  for (const k of Object.keys(row)) {
    const cleanKey = k.toLowerCase().replace(/[\s_-]+/g, "");
    for (const target of keys) {
      if (cleanKey === target.toLowerCase().replace(/[\s_-]+/g, "")) {
        const val = row[k];
        if (val !== undefined && val !== null && String(val).trim() !== "") {
          return String(val).trim();
        }
      }
    }
  }
  return null;
}

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file) {
      return NextResponse.json({ detail: "No file uploaded" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let workbook;
    try {
      workbook = XLSX.read(buffer, { type: "buffer" });
    } catch (parseErr) {
      return NextResponse.json(
        { detail: "Unable to parse file. Please upload a valid Excel (.xlsx, .xls) or CSV file." },
        { status: 400 }
      );
    }

    const sheetName = workbook.SheetNames?.[0];
    if (!sheetName) {
      return NextResponse.json(
        { detail: "Uploaded spreadsheet contains no sheets." },
        { status: 400 }
      );
    }

    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    if (!rows || rows.length === 0) {
      return NextResponse.json(
        { detail: "File must contain a header row and at least one data row." },
        { status: 400 }
      );
    }

    const newFacilities = [];
    const timestamp = Date.now();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const name = getVal(row, ["name", "facility_name", "facilityname", "hospital_name", "dispensary_name"]);
      const address = getVal(row, ["address", "addr", "location"]);

      // Skip empty blank rows
      if (!name && !address) continue;

      const latVal = getVal(row, ["latitude", "lat"]);
      const lngVal = getVal(row, ["longitude", "long", "lng"]);

      newFacilities.push({
        id: `fac-${timestamp}-${i + 1}`,
        name: name || "Unnamed Facility",
        facility_type: getVal(row, ["facility_type", "facilitytype", "type"]) || "Dispensary",
        scheme: getVal(row, ["scheme", "scheme_name"]) || "ESIS",
        address: address || "",
        district: getVal(row, ["district"]) || "",
        block: getVal(row, ["block"]) || null,
        pincode: getVal(row, ["pincode", "pin", "postalcode", "zip"]) || null,
        state: getVal(row, ["state"]) || "Assam",
        latitude: latVal && !isNaN(Number(latVal)) ? Number(latVal) : null,
        longitude: lngVal && !isNaN(Number(lngVal)) ? Number(lngVal) : null,
        site_code: getVal(row, ["site_code", "sitecode", "code"]) || null,
        phone: getVal(row, ["phone", "contact", "mobile", "phonenumber"]) || null,
        active: true,
      });
    }

    if (newFacilities.length === 0) {
      return NextResponse.json(
        { detail: "No valid facility rows found in the uploaded file." },
        { status: 400 }
      );
    }

    const totalCount = await addFacilities(newFacilities);

    return NextResponse.json({
      imported: newFacilities.length,
      total_facilities: totalCount,
    });
  } catch (err) {
    return NextResponse.json(
      { detail: `Upload import failed: ${err.message}` },
      { status: 500 }
    );
  }
}

