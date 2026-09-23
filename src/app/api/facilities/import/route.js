import { NextResponse } from "next/server";
import { addFacilities, getFacilities } from "@/lib/db";

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file) {
      return NextResponse.json({ detail: "No file uploaded" }, { status: 400 });
    }

    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);

    if (lines.length < 2) {
      return NextResponse.json(
        { detail: "CSV file must contain a header row and data rows" },
        { status: 400 }
      );
    }

    const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
    const newFacilities = [];

    for (let i = 1; i < lines.length; i++) {
      const row = lines[i].split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
      if (row.length === 0 || !row[0]) continue;

      const obj = {};
      headers.forEach((h, idx) => {
        obj[h] = row[idx] ?? null;
      });

      newFacilities.push({
        id: `fac-${Date.now()}-${i}`,
        name: obj.name || "Unnamed Facility",
        facility_type: obj.facility_type || "Dispensary",
        scheme: obj.scheme || "ESIS",
        address: obj.address || "",
        district: obj.district || "",
        block: obj.block || null,
        pincode: obj.pincode || null,
        state: obj.state || "Assam",
        latitude: obj.latitude ? Number(obj.latitude) : null,
        longitude: obj.longitude ? Number(obj.longitude) : null,
        site_code: obj.site_code || null,
        phone: obj.phone || null,
        active: true,
      });
    }

    const totalCount = await addFacilities(newFacilities);

    return NextResponse.json({
      imported: newFacilities.length,
      total_facilities: totalCount,
    });
  } catch (err) {
    return NextResponse.json(
      { detail: `CSV import failed: ${err.message}` },
      { status: 500 }
    );
  }
}
