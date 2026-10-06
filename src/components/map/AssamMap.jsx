"use client";

import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { normalizeDistrict } from "@/lib/districts";
import {
  deriveSubType,
  sanitizeCoordinates,
  isEsicHospital,
  isGovtDistrictHospital,
  isDispensary,
  isTieUp,
  calculateRoadDistanceKm,
} from "@/lib/geo";

const AssamMap = forwardRef(function AssamMap(
  {
    facilities = [],
    filters = { mapLayer: "minimal", district: "all", searchQuery: "", radius: 0 },
    targetLocation = null,
    isPinModeActive = false,
    onPinDropped,
    onDistrictSelect,
    selectedFacility = null,
    onMapReady,
    theme = "light",
    isLargeView = false,
  },
  ref
) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerLayerGroupRef = useRef(null);
  const markersMapRef = useRef(new Map());
  const geoJsonLayerRef = useRef(null);
  const currentTileLayerRef = useRef(null);
  const maskLayerRef = useRef(null);
  const [geoJsonData, setGeoJsonData] = useState(null);

  // Helper to create tile layer (Minimal = CARTO Voyager, Detailed = Google Maps)
  const createTileLayer = (mode = "minimal") => {
    if (mode === "detailed") {
      return L.tileLayer("https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}", {
        subdomains: ["0", "1", "2", "3"],
        maxZoom: 21,
        crossOrigin: true,
        attribution: "&copy; Google Maps",
      });
    }

    // Minimal mode: CARTO Voyager
    const cartoKey = process.env.NEXT_PUBLIC_CARTO_API_KEY || "cb1_2x3z_1_a51a4908ac72271d9917a2a2";
    const cartoUrl = `https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}.png?key=${cartoKey}`;

    return L.tileLayer(cartoUrl, {
      subdomains: "abcd",
      maxZoom: 21,
      crossOrigin: true,
      attribution: "&copy; CARTO &copy; OpenStreetMap contributors",
    });
  };

  // 1. Initialize Leaflet Map once
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
    const baseZoom = isMobile ? 6.5 : 7.2;
    const baseCenter = [26.2006, 92.9376];

    const map = L.map(mapContainerRef.current, {
      preferCanvas: true,
      center: baseCenter,
      zoom: baseZoom,
      zoomSnap: 0.5,
      zoomDelta: 0.5,
      minZoom: isMobile ? 5.5 : 6.0,
      maxZoom: 18,
      wheelPxPerZoomLevel: 100,
      zoomControl: false,
      attributionControl: false,
    });

    L.control.zoom({ position: "bottomright" }).addTo(map);

    // Initial Minimal Tile Layer
    const initialMapLayer = createTileLayer(filters?.mapLayer || "minimal");
    initialMapLayer.addTo(map);
    currentTileLayerRef.current = initialMapLayer;

    // Marker Layer Group
    const markerGroup = L.layerGroup().addTo(map);
    markerLayerGroupRef.current = markerGroup;

      // Dynamic Zoom handler: dynamically scale district name font size and toggle facility names based on zoom/mode
    const handleZoomUpdate = () => {
      const currentZoom = map.getZoom();
      const container = map.getContainer();
      container.setAttribute("data-zoom", Math.floor(currentZoom).toString());

      // Show facility labels only when zoomed in (or in large map view when zoom >= 9.5, otherwise zoom >= 11.5)
      const labelZoomThreshold = isLargeView ? 9.5 : 11.5;
      if (currentZoom >= labelZoomThreshold) {
        container.classList.add("show-marker-labels");
      } else {
        container.classList.remove("show-marker-labels");
      }

      if (currentZoom <= 7.5) {
        container.classList.add("map-zoomed-out");
      } else {
        container.classList.remove("map-zoomed-out");
      }

      // Dynamic district name sizing
      let dynamicSize = 11;
      if (currentZoom < 7.5) dynamicSize = 9;
      else if (currentZoom < 8.5) dynamicSize = 11;
      else if (currentZoom < 9.5) dynamicSize = 14;
      else if (currentZoom < 10.5) dynamicSize = 18;
      else if (currentZoom < 11.5) dynamicSize = 22;
      else dynamicSize = 26;

      const labels = container.querySelectorAll(".district-label-tooltip");
      labels.forEach((lbl) => {
        lbl.style.fontSize = `${dynamicSize}px`;
      });
    };

    map.on("zoom", handleZoomUpdate);
    map.on("zoomend", handleZoomUpdate);
    handleZoomUpdate();

    mapInstanceRef.current = map;

    // Load GeoJSON data (Local file with fallback to CDN)
    fetch("/data/ASSAM_DISTRICTS.geojson")
      .then((res) => {
        if (!res.ok) throw new Error("Local GeoJSON failed");
        return res.json();
      })
      .catch(() =>
        fetch("https://cdn.jsdelivr.net/gh/datta07/INDIAN-SHAPEFILES@master/STATES/ASSAM/ASSAM_DISTRICTS.geojson").then(
          (res) => res.json()
        )
      )
      .then((data) => {
        setGeoJsonData(data);
      })
      .catch((err) => {
        console.error("GeoJSON load failed:", err);
      });

    const handleResize = () => {
      map.invalidateSize();
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update container class and label visibility when large view is toggled
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const container = map.getContainer();
    if (isLargeView) {
      container.classList.add("map-large-view");
      container.classList.remove("map-small-view");
    } else {
      container.classList.add("map-small-view");
      container.classList.remove("map-large-view");
    }

    const currentZoom = map.getZoom();
    const labelZoomThreshold = isLargeView ? 9.5 : 11.5;
    if (currentZoom >= labelZoomThreshold) {
      container.classList.add("show-marker-labels");
    } else {
      container.classList.remove("show-marker-labels");
    }
  }, [isLargeView]);

  // 2. Handle Layer Switch (Minimal vs Detailed)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (currentTileLayerRef.current) {
      map.removeLayer(currentTileLayerRef.current);
    }

    const newLayer = createTileLayer(filters?.mapLayer || "minimal");
    newLayer.addTo(map);
    currentTileLayerRef.current = newLayer;
  }, [filters?.mapLayer]);

  // 3. Render Inverted Dark Mask & District Boundaries
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !geoJsonData) return;

    // Remove existing mask and geojson layers if any
    if (maskLayerRef.current) {
      map.removeLayer(maskLayerRef.current);
      maskLayerRef.current = null;
    }
    if (geoJsonLayerRef.current) {
      map.removeLayer(geoJsonLayerRef.current);
      geoJsonLayerRef.current = null;
    }

    try {
      // Create inverted solid dark blue mask covering everything outside Assam
      const worldCoords = [
        [90, -360],
        [-90, -360],
        [-90, 360],
        [90, 360],
      ];
      const holes = [];

      geoJsonData.features.forEach((f) => {
        if (f.geometry.type === "Polygon") {
          holes.push(f.geometry.coordinates[0].map((c) => [c[1], c[0]]));
        } else if (f.geometry.type === "MultiPolygon") {
          f.geometry.coordinates.forEach((poly) => {
            holes.push(poly[0].map((c) => [c[1], c[0]]));
          });
        }
      });

      // Dark Mask Polygon: Pure 100% solid dark blue (#0a1128) covering outside Assam
      const maskPoly = L.polygon([worldCoords, ...holes], {
        stroke: false,
        fillColor: "#0a1128",
        fillOpacity: 1.0,
        interactive: false,
      }).addTo(map);
      maskLayerRef.current = maskPoly;

      // District Border & Tooltips Layer
      const gjLayer = L.geoJSON(geoJsonData, {
        style: {
          color: "#60a5fa",
          weight: 1.5,
          fillColor: "transparent",
          fillOpacity: 0,
        },
        onEachFeature: (feature, layer) => {
          let districtName =
            feature.properties.dtname ||
            feature.properties.district ||
            feature.properties.DISTRICT ||
            feature.properties.name;

          if (districtName) {
            const dLower = districtName.toLowerCase();
            if (dLower.includes("salmara")) {
              districtName = "South Salmara";
            } else if (dLower.includes("kamrup") && dLower.includes("metropolitan")) {
              districtName = "Kamrup Metro";
            }

            layer.bindTooltip(districtName, {
              permanent: true,
              direction: "center",
              interactive: false,
              className: "district-label-tooltip",
            });

            layer.on({
              click: () => {
                if (onDistrictSelect) {
                  const norm = normalizeDistrict(districtName);
                  if (norm === "kamrup metro") {
                    onDistrictSelect("Kamrup Metro");
                  } else {
                    onDistrictSelect(districtName);
                  }
                }
              },
            });
          }
        },
      }).addTo(map);

      geoJsonLayerRef.current = gjLayer;
    } catch (e) {
      console.error("Mask rendering error:", e);
    }
  }, [geoJsonData, onDistrictSelect, theme]);

  // 4. Highlight Selected District Polygon & Zoom to District
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!geoJsonLayerRef.current || !map) return;

    const selectedNorm = normalizeDistrict(filters?.district);
    const searchNorm = normalizeDistrict(filters?.searchQuery);
    let matchedDistrictLayer = null;

    geoJsonLayerRef.current.eachLayer((layer) => {
      const props = layer.feature.properties;
      const layerDist = props.dtname || props.district || props.DISTRICT || props.name || "";
      const ldNorm = normalizeDistrict(layerDist);

      const matchesDropdown = filters?.district && filters?.district !== "all" && ldNorm === selectedNorm;
      const matchesSearch = searchNorm !== "" && ldNorm === searchNorm;

      if (matchesDropdown || matchesSearch) {
        matchedDistrictLayer = layer;
        layer.setStyle({
          color: "#ef4444",
          weight: 3.5,
          fillColor: "#ef4444",
          fillOpacity: 0.35,
        });
        layer.bringToFront();
      } else {
        layer.setStyle({
          color: "#60a5fa",
          weight: 1.5,
          fillColor: "transparent",
          fillOpacity: 0,
        });
      }
    });

    if (!targetLocation || targetLocation.lat == null) {
      if (matchedDistrictLayer && matchedDistrictLayer.getBounds) {
        map.flyToBounds(matchedDistrictLayer.getBounds(), { padding: [50, 50], maxZoom: 11 });
      } else if (filters?.district === "all" && !filters?.searchQuery) {
        const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
        map.flyTo([26.2006, 92.9376], isMobile ? 6.5 : 7.2);
      }
    }
  }, [filters?.district, filters?.searchQuery, geoJsonData, theme, targetLocation]);

  // 5. Render Facility Markers & Target Location
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markerGroup = markerLayerGroupRef.current;
    if (!map || !markerGroup) return;

    markerGroup.clearLayers();
    markersMapRef.current.clear();

    // Render target pin and radius circle if target active
    if (targetLocation && targetLocation.lat != null && targetLocation.lng != null) {
      const targetIcon = L.divIcon({
        html: `
          <div class="caller-red-pin-wrapper" style="position: relative; display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; cursor: pointer;">
            <div style="position: absolute; width: 14px; height: 14px; background: rgba(220, 38, 38, 0.45); border-radius: 50%; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite; bottom: 2px;"></div>
            <svg viewBox="0 0 24 24" width="38" height="38" style="filter: drop-shadow(0 3px 5px rgba(0,0,0,0.55)); transform: translateY(-8px);">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#dc2626" stroke="#ffffff" stroke-width="1.75"/>
              <circle cx="12" cy="9" r="3.2" fill="#ffffff"/>
            </svg>
          </div>
        `,
        className: "",
        iconSize: [44, 44],
        iconAnchor: [22, 38],
        popupAnchor: [0, -38],
      });

      const targetPin = L.marker([targetLocation.lat, targetLocation.lng], {
        icon: targetIcon,
        zIndexOffset: 1000,
      });
      targetPin.bindPopup(
        `<div style="font-family: inherit; font-size: 12px; padding: 4px;">
          <strong style="color: #0f172a; display: flex; align-items: center; gap: 4px; font-weight: 700;">📍 ${targetLocation.name || "Selected Location"}</strong>
          <div style="margin-top: 3px; font-size: 11px; color: #64748b; font-family: monospace;">Coords: ${Number(targetLocation.lat).toFixed(4)}, ${Number(targetLocation.lng).toFixed(4)}</div>
        </div>`
      );
      markerGroup.addLayer(targetPin);

      const activeRadius = filters?.radius !== undefined ? filters.radius : targetLocation.radius;
      if (activeRadius > 0) {
        const circle = L.circle([targetLocation.lat, targetLocation.lng], {
          color: "#2563eb",
          fillColor: "#3b82f6",
          fillOpacity: 0.15,
          weight: 2.5,
          radius: activeRadius * 1000,
        });
        circle.bindTooltip(`Within ${activeRadius} km`, { sticky: true });
        markerGroup.addLayer(circle);
      }
    }

    // Render facilities
    facilities.forEach((hosp, idx) => {
      let rawLat = hosp.lat ?? hosp.latitude;
      let rawLng = hosp.lng ?? hosp.longitude ?? hosp.lon;
      const coords = sanitizeCoordinates(rawLat, rawLng);
      if (coords.lat === null || coords.lng === null) return;

      const lat = coords.lat;
      const lng = coords.lng;

      const rawType = (hosp.type || hosp.facility_type || "NHM").toUpperCase();
      const subType = hosp.subType || deriveSubType(hosp.name || "", rawType);
      const nameUpper = (hosp.name || "").toUpperCase();

      let badgeTheme = "facility-red";
      let markerTheme = "marker-dispensary";
      let flagColor = "#ef4444"; // ESIS Dispensary (Red)
      let typeLabel = "ESIS Dispensary";

      if (rawType.includes("108") || nameUpper.includes("108") || nameUpper.includes("AMBULANCE")) {
        badgeTheme = "esic-red";
        markerTheme = "marker-108";
        flagColor = "#dc2626"; // 108 Ambulance (Red)
        typeLabel = "108 Ambulance";
      } else if (
        isGovtDistrictHospital(hosp) ||
        hosp.is_govt_district_hospital ||
        subType === "DH" ||
        subType.includes("District Hospital") ||
        nameUpper.includes("CIVIL HOSPITAL") ||
        nameUpper.includes("DISTRICT HOSPITAL") ||
        nameUpper.includes("MEDICAL COLLEGE") ||
        rawType.includes("CIVIL") ||
        rawType.includes("DISTRICT")
      ) {
        badgeTheme = "facility-purple";
        markerTheme = "marker-dh";
        flagColor = "#9333ea"; // Govt District Hospital (Purple)
        typeLabel = "Govt District Hospital";
      } else if (
        isEsicHospital(hosp) ||
        hosp.is_esic_hospital ||
        nameUpper.includes("ESIC HOSPITAL") ||
        (rawType === "ESIC" && subType.includes("Hospital") && !nameUpper.includes("CIVIL") && !nameUpper.includes("TIE"))
      ) {
        badgeTheme = "facility-blue";
        markerTheme = "marker-esic-hospital";
        flagColor = "#2563eb"; // ESIC Hospital (Blue)
        typeLabel = "ESIC Hospital";
      } else if (
        isTieUp(hosp) ||
        hosp.is_tie_up ||
        nameUpper.includes("TIE UP") ||
        nameUpper.includes("TIE-UP") ||
        subType.includes("Tie-Up") ||
        subType.includes("Tie Up") ||
        rawType.includes("TIE")
      ) {
        badgeTheme = "facility-yellow";
        markerTheme = "marker-tieup";
        flagColor = "#eab308"; // Tie-Up Hospital (Yellow)
        typeLabel = "Tie-Up Hospital";
      } else if (
        isDispensary(hosp) ||
        hosp.is_dispensary ||
        nameUpper.includes("DISPENSARY") ||
        subType.includes("Dispensary") ||
        subType.includes("ESIS") ||
        rawType.includes("DISPENSARY")
      ) {
        badgeTheme = "facility-red";
        markerTheme = "marker-dispensary";
        flagColor = "#ef4444"; // ESIS Dispensary (Red)
        typeLabel = "ESIS Dispensary";
      } else if (subType === "PHC" || subType.includes("Primary") || nameUpper.includes("PHC")) {
        badgeTheme = "facility-purple";
        markerTheme = "marker-phc";
        flagColor = "#9333ea"; // Primary Health Centre (Purple)
        typeLabel = "Primary Health Centre";
      } else {
        badgeTheme = "facility-purple";
        markerTheme = "marker-sdh";
        flagColor = "#9333ea"; // Community Health Centre (Purple)
        typeLabel = "Community Health Centre";
      }

      const svgIcon = `<svg viewBox="0 0 100 100" width="36" height="36" style="filter: drop-shadow(0 2px 3px rgba(0,0,0,0.25));"><path d="M 25 15 L 95 35 L 25 55 Z" fill="${flagColor}"/><rect x="21" y="12" width="8" height="85" rx="3" fill="${flagColor}"/></svg>`;

      const customIcon = L.divIcon({
        html: `
          <div class="custom-marker ${markerTheme}" style="position: relative; display: flex; align-items: center; justify-content: flex-start; background: transparent; border: none; overflow: visible;">
            ${svgIcon}
            <div class="facility-label" style="color: ${flagColor};">${hosp.name}</div>
          </div>
        `,
        className: "",
        iconSize: [36, 36],
        iconAnchor: [10, 36],
        popupAnchor: [10, -36],
      });

      const marker = L.marker([lat, lng], { icon: customIcon });

      const cleanAddr = hosp.address
        ? hosp.address
            .replace(/[\uFFFD\u00BF\u00EF\u00BF\u00BD]+/g, " - ")
            .replace(/\s*-\s*-\s*/g, " - ")
            .replace(/,\s*,/g, ",")
            .replace(/\s*,\s*$/g, "")
            .trim()
        : "";

      let effectiveKm = hosp.distance_km != null ? hosp.distance_km : null;
      if (
        effectiveKm == null &&
        targetLocation &&
        targetLocation.lat != null &&
        targetLocation.lng != null &&
        hosp.latitude != null &&
        hosp.longitude != null
      ) {
        effectiveKm = calculateRoadDistanceKm(
          Number(targetLocation.lat),
          Number(targetLocation.lng),
          Number(hosp.latitude),
          Number(hosp.longitude)
        );
      }

      const approxKmText =
        effectiveKm != null
          ? `Approx ${effectiveKm < 10 ? Number(effectiveKm).toFixed(1) : Math.round(effectiveKm)} KM`
          : "";

      marker.bindPopup(`
        <div class="custom-popup p-2 font-sans text-xs min-w-[260px] max-w-[340px]">
          <div class="mb-2">
            <div class="flex items-center justify-between gap-2 mb-1.5">
              <span class="inline-flex items-center whitespace-nowrap px-2.5 py-0.5 rounded-md text-[10.5px] font-bold border tracking-wide shadow-2xs ${badgeTheme}">
                ${typeLabel}
              </span>
              ${
                approxKmText
                  ? `<span class="inline-flex items-center whitespace-nowrap rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-0.5 text-[11px] font-bold text-slate-700 dark:text-slate-200">${approxKmText}</span>`
                  : ""
              }
            </div>
            <h4 class="font-bold text-sm text-slate-900 leading-snug break-words">
              ${hosp.name}
            </h4>
          </div>

          <div class="space-y-1 text-slate-600 text-[11px] border-t border-slate-100 pt-1.5">
            ${hosp.district ? `<p><strong class="text-slate-700">District:</strong> ${hosp.district}</p>` : ""}
            ${hosp.block ? `<p><strong class="text-slate-700">Block:</strong> ${hosp.block}</p>` : ""}
            ${cleanAddr ? `<p class="leading-relaxed"><strong class="text-slate-700">Address:</strong> ${cleanAddr}</p>` : ""}
            ${hosp.phone ? `<p><strong class="text-slate-700">Phone:</strong> <span class="font-mono font-bold text-blue-600">${hosp.phone}</span></p>` : ""}
          </div>
        </div>
      `, { maxWidth: 360 });

      markerGroup.addLayer(marker);
      if (hosp.id) {
        markersMapRef.current.set(String(hosp.id), marker);
      }
      if (hosp.name) {
        markersMapRef.current.set(String(hosp.name), marker);
        markersMapRef.current.set(String(hosp.name).toLowerCase().trim(), marker);
      }
    });

    // Auto-fit camera to target location
    if (targetLocation && targetLocation.lat != null && targetLocation.lng != null) {
      map.stop();
      const activeRadius = filters?.radius !== undefined ? filters.radius : targetLocation?.radius || 0;
      if (activeRadius > 0) {
        const circleBounds = L.latLng([targetLocation.lat, targetLocation.lng]).toBounds(activeRadius * 1000 * 2);
        map.flyToBounds(circleBounds, { padding: [50, 50], maxZoom: 13, duration: 0.8 });
      } else {
        map.flyTo([targetLocation.lat, targetLocation.lng], 11, { duration: 0.8 });
      }
    }
  }, [facilities, targetLocation, filters?.district, filters?.searchQuery, filters?.radius]);

  // 6. Handle Drop Pin Mode clicks
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const handleMapClick = async (e) => {
      if (!isPinModeActive) return;

      const { lat, lng } = e.latlng;
      const initialRadius = filters?.radius > 0 ? filters.radius : 15;

      // Immediately drop pin
      if (onPinDropped) {
        onPinDropped({
          lat,
          lng,
          radius: initialRadius,
          name: `Dropped Pin (${lat.toFixed(2)}, ${lng.toFixed(2)})`,
          isDroppedPin: true,
        });
      }

      // Reverse geocode asynchronously for friendly name
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
        );
        if (res.ok) {
          const data = await res.json();
          const rawPostcode = data?.address?.postcode;
          const validPin = rawPostcode && /^\d{6}$/.test(rawPostcode.trim()) ? rawPostcode.trim() : null;

        const placeName =
          data?.address?.suburb ||
          data?.address?.neighbourhood ||
          data?.address?.residential ||
          data?.address?.village ||
          data?.address?.town ||
          data?.address?.city ||
          data?.display_name?.split(",")[0] ||
          `Pin (${lat.toFixed(2)}, ${lng.toFixed(2)})`;

        const districtName =
          data?.address?.state_district ||
          data?.address?.county ||
          data?.address?.district ||
          null;

          if (onPinDropped) {
            onPinDropped({
              lat,
              lng,
              radius: initialRadius,
              name: placeName,
              city: placeName,
              district: districtName,
              pincode: validPin,
              isDroppedPin: true,
            });
          }
        }
      } catch (err) {
        // keep initial pin
      }
    };

    if (isPinModeActive) {
      map.getContainer().classList.add("map-crosshair");
      map.on("click", handleMapClick);
    } else {
      map.getContainer().classList.remove("map-crosshair");
    }

    return () => {
      map.off("click", handleMapClick);
    };
  }, [isPinModeActive, filters?.radius, onPinDropped]);

  // 7. Helper to focus facility on map & open its popup
  const executeFocus = (facility) => {
    const map = mapInstanceRef.current;
    if (!map || !facility) return;

    let rawLat = facility.lat ?? facility.latitude;
    let rawLng = facility.lng ?? facility.longitude ?? facility.lon;
    const coords = sanitizeCoordinates(rawLat, rawLng);
    if (coords.lat === null || coords.lng === null) return;

    const lat = coords.lat;
    const lng = coords.lng;

    map.stop();
    map.flyTo([lat, lng], 14, { duration: 0.8 });

    const openTargetPopup = () => {
      let targetMarker = null;
      if (facility.id && markersMapRef.current.has(String(facility.id))) {
        targetMarker = markersMapRef.current.get(String(facility.id));
      } else if (facility.name && markersMapRef.current.has(String(facility.name))) {
        targetMarker = markersMapRef.current.get(String(facility.name));
      } else if (facility.name && markersMapRef.current.has(String(facility.name).toLowerCase().trim())) {
        targetMarker = markersMapRef.current.get(String(facility.name).toLowerCase().trim());
      }

      if (!targetMarker) {
        markersMapRef.current.forEach((marker) => {
          if (!targetMarker) {
            const mLatLng = marker.getLatLng();
            if (
              Math.abs(mLatLng.lat - lat) < 0.002 &&
              Math.abs(mLatLng.lng - lng) < 0.002
            ) {
              targetMarker = marker;
            }
          }
        });
      }

      if (targetMarker) {
        targetMarker.openPopup();
      }
    };

    // Open immediately and upon flight completion
    openTargetPopup();
    map.once("moveend", openTargetPopup);
    setTimeout(openTargetPopup, 400);
    setTimeout(openTargetPopup, 850);
  };

  // Auto-Fly and Open Popup on Selected Facility
  useEffect(() => {
    if (!selectedFacility) return;
    executeFocus(selectedFacility);
  }, [selectedFacility]);

  // Expose imperative ref methods and call onMapReady
  const imperativeMethods = {
    focusFacility: (facility) => {
      executeFocus(facility);
    },
    invalidateSize: () => {
      const map = mapInstanceRef.current;
      if (map) {
        map.invalidateSize();
      }
    },
    resetView: () => {
      const map = mapInstanceRef.current;
      if (map) {
        map.flyTo([26.2006, 92.9376], 7.2);
      }
    },
    flyTo: (coords, zoom = 11) => {
      const map = mapInstanceRef.current;
      if (map && Array.isArray(coords)) {
        map.stop();
        map.flyTo(coords, zoom, { duration: 0.8 });
      }
    },
  };

  useImperativeHandle(ref, () => imperativeMethods);

  useEffect(() => {
    if (onMapReady) {
      onMapReady(imperativeMethods);
    }
  }, []);

  return (
    <div
      ref={mapContainerRef}
      className="w-full h-full bg-[#0a1128] relative overflow-hidden select-none rounded-xl"
    />
  );
});

export default AssamMap;
