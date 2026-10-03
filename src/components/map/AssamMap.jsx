"use client";

import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { normalizeDistrict } from "@/lib/districts";
import { deriveSubType, sanitizeCoordinates } from "@/lib/geo";

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

    // Dynamic Zoom handler: dynamically scale district name font size based on zoom
    const handleZoomUpdate = () => {
      const currentZoom = map.getZoom();
      const container = map.getContainer();
      container.setAttribute("data-zoom", Math.floor(currentZoom).toString());

      if (currentZoom >= 10) {
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

      // Dark Mask Polygon: Pure 100% solid dark blue (#0a1128)
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
  }, [geoJsonData, onDistrictSelect]);

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

    if (matchedDistrictLayer && matchedDistrictLayer.getBounds) {
      map.flyToBounds(matchedDistrictLayer.getBounds(), { padding: [50, 50], maxZoom: 11 });
    } else if (filters?.district === "all" && !filters?.searchQuery && !targetLocation) {
      const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
      map.flyTo([26.2006, 92.9376], isMobile ? 6.5 : 7.2);
    }
  }, [filters?.district, filters?.searchQuery, geoJsonData]);

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
        html: `<div style="font-size:32px; text-shadow: 0px 3px 6px rgba(0,0,0,0.4); margin-top:-10px;">📍</div>`,
        className: "",
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32],
      });

      const targetPin = L.marker([targetLocation.lat, targetLocation.lng], {
        icon: targetIcon,
        zIndexOffset: 1000,
      });
      targetPin.bindPopup(
        `<strong>📍 Caller / Location:</strong><br><span style="text-transform:capitalize;">${targetLocation.name || "Target Location"}</span>`
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

      let badgeTheme = "chc";
      let markerTheme = "marker-chc";
      let flagColor = "#10b981"; // CHC green

      if (rawType === "ESIC" || subType.includes("ESIC") || subType.includes("ESIS")) {
        if (subType.includes("Tie-Up") || subType.includes("Tie Up")) {
          badgeTheme = "esic-yellow";
          markerTheme = "marker-esic-yellow";
          flagColor = "#e19b03";
        } else if (subType.includes("Hospital")) {
          badgeTheme = "esic-blue";
          markerTheme = "marker-esic-blue";
          flagColor = "#3b82f6";
        } else {
          badgeTheme = "esic-red";
          markerTheme = "marker-esic-red";
          flagColor = "#ef4444";
        }
      } else {
        if (subType === "DH" || subType.includes("District Hospital")) {
          badgeTheme = "dh";
          markerTheme = "marker-dh";
          flagColor = "#a855f7";
        } else if (subType === "SDH" || subType.includes("Sub")) {
          badgeTheme = "sdh";
          markerTheme = "marker-sdh";
          flagColor = "#1f2937";
        } else if (subType === "PHC" || subType.includes("Primary")) {
          badgeTheme = "phc";
          markerTheme = "marker-phc";
          flagColor = "#38bdf8";
        }
      }

      const svgIcon = `<svg viewBox="0 0 100 100" width="36" height="36"><path d="M 25 15 L 95 35 L 25 55 Z" fill="${flagColor}"/><rect x="21" y="12" width="8" height="85" rx="3" fill="${flagColor}"/></svg>`;

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

      const displayId = hosp.displayId || (rawType === "ESIC" ? `E${idx + 1}` : `N${idx + 1}`);

      marker.bindPopup(`
        <div class="custom-popup p-1 font-sans text-xs">
          <div class="flex items-center gap-1.5 mb-1.5 font-bold text-sm text-slate-900">
            <span class="px-1.5 py-0.5 rounded text-[10px] font-mono border ${badgeTheme}">${displayId}</span>
            <span>${hosp.name}</span>
          </div>
          <p class="text-slate-600 mb-1"><strong>District:</strong> ${hosp.district || "Assam"}</p>
          ${hosp.block ? `<p class="text-slate-600 mb-1"><strong>Block:</strong> ${hosp.block}</p>` : ""}
          ${hosp.address ? `<p class="text-slate-600 mb-1"><strong>Address:</strong> ${hosp.address}</p>` : ""}
          ${hosp.pincode ? `<p class="text-slate-600 mb-1"><strong>Pincode:</strong> ${hosp.pincode}</p>` : ""}
          ${
            hosp.distance_km != null
              ? `<p class="text-slate-700 font-semibold mb-1"><strong>Distance:</strong> ${hosp.distance_km === 0 ? "0 km" : `${Number(hosp.distance_km).toFixed(1)} km`}</p>`
              : ""
          }
          ${
            hosp.gmap || hosp.maps_url
              ? `<a href="${hosp.gmap || hosp.maps_url}" target="_blank" rel="noopener noreferrer" class="text-blue-600 font-semibold hover:underline inline-block mt-1">Directions (Google Maps) ↗</a>`
              : ""
          }
        </div>
      `);

      markerGroup.addLayer(marker);
      const fid = hosp.id || hosp.name;
      if (fid) {
        markersMapRef.current.set(fid, marker);
      }
    });

    // Auto-fit camera if filtering
    const activeRadius = filters?.radius !== undefined ? filters.radius : targetLocation?.radius || 0;
    if (targetLocation && targetLocation.lat != null && activeRadius > 0) {
      const circleBounds = L.latLng([targetLocation.lat, targetLocation.lng]).toBounds(activeRadius * 1000 * 2);
      map.flyToBounds(circleBounds, { padding: [50, 50], maxZoom: 13 });
    } else if (targetLocation && targetLocation.lat != null) {
      map.flyTo([targetLocation.lat, targetLocation.lng], 11);
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
        });
      }

      // Reverse geocode asynchronously for friendly name
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
        );
        const data = await res.json();
        const placeName =
          data?.display_name?.split(",")[0] ||
          data?.address?.village ||
          data?.address?.town ||
          data?.address?.suburb ||
          data?.address?.city ||
          `Pin (${lat.toFixed(2)}, ${lng.toFixed(2)})`;

        if (onPinDropped) {
          onPinDropped({
            lat,
            lng,
            radius: initialRadius,
            name: placeName,
          });
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
      const fid = facility.id || facility.name;
      if (fid && markersMapRef.current.has(fid)) {
        targetMarker = markersMapRef.current.get(fid);
      }

      if (!targetMarker) {
        markersMapRef.current.forEach((marker) => {
          if (!targetMarker) {
            const mLatLng = marker.getLatLng();
            if (
              Math.abs(mLatLng.lat - lat) < 0.001 &&
              Math.abs(mLatLng.lng - lng) < 0.001
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

    map.once("moveend", openTargetPopup);
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
