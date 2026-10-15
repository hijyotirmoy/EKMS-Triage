"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import {
  Search,
  Bell,
  Check,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  MoreHorizontal,
  MessageSquare,
  Heart,
  Sliders,
  Calendar,
  FileText,
  LayoutGrid,
  Phone,
  ChevronsUpDown,
  X,
  RotateCcw,
  ArrowLeftToLine,
  ArrowRightToLine,
  ArrowLeft,
  ArrowDownUp,
  Plus,
  ArrowUpRight,
  Filter,
  ExternalLink,
  Minus,
  User,
  Power,
  Coffee,
  Ban,
  Users,
  PhoneForwarded,
  History,
  Maximize2,
  PhoneCall,
  PhoneIncoming,
  PhoneOff,
  Mic,
  MicOff,
  Pause,
  Play,
  Save,
  Eye,
  ArrowRight,
  Info,
  UserCheck,
  Volume2,
  ClipboardCheck,
  Trash2,
  AlertTriangle,
  Clock,
  Stethoscope,
  Sparkles,
  Send,
  Mail,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import { playRingtone, stopRingtone } from "@/lib/webrtc";
import { getFirestoreDb, getCrmFirestoreDb } from "@/lib/firebase";
import { doc, setDoc, updateDoc, deleteDoc, collection, query, where, onSnapshot, getDocs } from "firebase/firestore";
import { broadcastEvent, subscribeToSync } from "@/lib/broadcastSync";
import {
  getCachedCrmBeneficiaries,
  setCachedCrmBeneficiaries,
  isCrmBeneficiariesCacheFresh,
  getCachedCrmCallHistory,
  setCachedCrmCallHistory,
  appendCrmCallLog,
  getCachedCases,
  appendCaseToLocalCache,
  getCachedAiChatSession,
  clearCachedAiChatSession,
} from "@/lib/clientCache";
import { generateNextCaseRef } from "@/lib/caseId";
import { extractCallerReportedProblems } from "@/lib/triageEngine";
import { EkmsAiChatArea } from "./EkmsAiChatArea";
import { TriageResultPanel } from "./TriageResultPanel";
import { CallerHistorySection } from "./CallerHistorySection";
import { normalizeUrgency } from "@/lib/api";

// ================= RANDOMIZED DEMO DATASETS =================

// 1. Task List / Beneficiaries (with Due Dates per status, 8-digit alphanumeric ID, and Test Campaign)
const DEMO_TASKS = [
  {
    "id": "260921-15571",
    "name": "KHEM BAHADUR SONAR",
    "beneficiaryName": "KHEM BAHADUR SONAR",
    "campaign": "Test Campaign",
    "dueDate": "15-05-2026",
    "status": "Closed",
    "timeAgo": "3 w",
    "comments": 0,
    "hasHeart": false
  },
  {
    "id": "260921-15572",
    "name": "AJIT BORA-1",
    "beneficiaryName": "AJIT BORA-1",
    "campaign": "Test Campaign",
    "dueDate": "30-08-2026",
    "status": "Closed",
    "timeAgo": "3 w",
    "comments": 0,
    "hasHeart": false
  },
  {
    "id": "260921-15573",
    "name": "BIJAY KR. RAI",
    "beneficiaryName": "BIJAY KR. RAI",
    "campaign": "Test Campaign",
    "dueDate": "15-05-2026",
    "status": "Closed",
    "timeAgo": "3 w",
    "comments": 0,
    "hasHeart": false
  },
  {
    "id": "260921-15574",
    "name": "Bharat Kumar Sah",
    "beneficiaryName": "Bharat Kumar Sah",
    "campaign": "Test Campaign",
    "dueDate": "30-08-2026",
    "status": "Closed",
    "timeAgo": "1 M",
    "comments": 0,
    "hasHeart": false
  },
  {
    "id": "260921-15575",
    "name": "BASAN GURIYA",
    "beneficiaryName": "BASAN GURIYA",
    "campaign": "Test Campaign",
    "dueDate": "15-05-2026",
    "status": "Closed",
    "timeAgo": "1 M",
    "comments": 0,
    "hasHeart": false
  },
  {
    "id": "260921-15576",
    "name": "BAHADUR BINJUWAR",
    "beneficiaryName": "BAHADUR BINJUWAR",
    "campaign": "Test Campaign",
    "dueDate": "30-08-2026",
    "status": "Closed",
    "timeAgo": "1 M",
    "comments": 0,
    "hasHeart": false
  },
  {
    "id": "260921-15577",
    "name": "ATUL RAY",
    "beneficiaryName": "ATUL RAY",
    "campaign": "Test Campaign",
    "dueDate": "15-05-2026",
    "status": "Closed",
    "timeAgo": "1 M",
    "comments": 0,
    "hasHeart": false
  },
  {
    "id": "260921-15578",
    "name": "ARUP RAJKONWAR",
    "beneficiaryName": "ARUP RAJKONWAR",
    "campaign": "Test Campaign",
    "dueDate": "30-08-2026",
    "status": "Closed",
    "timeAgo": "3 w",
    "comments": 0,
    "hasHeart": false
  },
  {
    "id": "260921-15579",
    "name": "ARAN JHARA",
    "beneficiaryName": "ARAN JHARA",
    "campaign": "Test Campaign",
    "dueDate": "15-05-2026",
    "status": "Closed",
    "timeAgo": "3 w",
    "comments": 0,
    "hasHeart": false
  },
  {
    "id": "260921-15580",
    "name": "ANIMA NATH",
    "beneficiaryName": "ANIMA NATH",
    "campaign": "Test Campaign",
    "dueDate": "30-08-2026",
    "status": "Closed",
    "timeAgo": "3 w",
    "comments": 0,
    "hasHeart": true
  },
  {
    "id": "260921-15581",
    "name": "ANIL BARMAN",
    "beneficiaryName": "ANIL BARMAN",
    "campaign": "Test Campaign",
    "dueDate": "15-05-2026",
    "status": "Closed",
    "timeAgo": "1 M",
    "comments": 0,
    "hasHeart": false
  },
  {
    "id": "260921-15582",
    "name": "AMAR DAHA",
    "beneficiaryName": "AMAR DAHA",
    "campaign": "Test Campaign",
    "dueDate": "30-08-2026",
    "status": "Closed",
    "timeAgo": "1 M",
    "comments": 0,
    "hasHeart": false
  },
  {
    "id": "260921-15583",
    "name": "ALISHA BEGUM",
    "beneficiaryName": "ALISHA BEGUM",
    "campaign": "Test Campaign",
    "dueDate": "15-05-2026",
    "status": "Closed",
    "timeAgo": "2 w",
    "comments": 0,
    "hasHeart": false
  },
  {
    "id": "260921-15584",
    "name": "PRABHAT BORAH",
    "beneficiaryName": "PRABHAT BORAH",
    "campaign": "Test Campaign",
    "dueDate": "30-08-2026",
    "status": "Closed",
    "timeAgo": "1 M",
    "comments": 0,
    "hasHeart": true
  },
  {
    "id": "260921-15585",
    "name": "DILIP SINGH",
    "beneficiaryName": "DILIP SINGH",
    "campaign": "Test Campaign",
    "dueDate": "15-05-2026",
    "status": "Closed",
    "timeAgo": "3 w",
    "comments": 0,
    "hasHeart": false
  },
  {
    "id": "260921-15586",
    "name": "DEEPAK LODH",
    "beneficiaryName": "DEEPAK LODH",
    "campaign": "Test Campaign",
    "dueDate": "30-08-2026",
    "status": "Closed",
    "timeAgo": "1 M",
    "comments": 0,
    "hasHeart": false
  },
  {
    "id": "260921-15587",
    "name": "DEBESWAR CHANGMAI",
    "beneficiaryName": "DEBESWAR CHANGMAI",
    "campaign": "Test Campaign",
    "dueDate": "15-05-2026",
    "status": "Closed",
    "timeAgo": "3 w",
    "comments": 0,
    "hasHeart": false
  },
  {
    "id": "260921-15588",
    "name": "BULU SHARMA",
    "beneficiaryName": "BULU SHARMA",
    "campaign": "Test Campaign",
    "dueDate": "30-08-2026",
    "status": "Closed",
    "timeAgo": "3 w",
    "comments": 0,
    "hasHeart": false
  },
  {
    "id": "260921-15589",
    "name": "BISWAJIT BHATTACHARJEE",
    "beneficiaryName": "BISWAJIT BHATTACHARJEE",
    "campaign": "Test Campaign",
    "dueDate": "15-05-2026",
    "status": "Closed",
    "timeAgo": "3 w",
    "comments": 0,
    "hasHeart": true
  },
  {
    "id": "260921-15590",
    "name": "MAYA BARUA",
    "beneficiaryName": "MAYA BARUA",
    "campaign": "Test Campaign",
    "dueDate": "30-08-2026",
    "status": "Closed",
    "timeAgo": "3 w",
    "comments": 0,
    "hasHeart": false
  },
  {
    "id": "260921-15591",
    "name": "MAYA BARUA",
    "beneficiaryName": "MAYA BARUA",
    "campaign": "Test Campaign",
    "dueDate": "20-09-2026",
    "status": "Delayed",
    "timeAgo": "3 w",
    "comments": 0,
    "hasHeart": false
  },
  {
    "id": "260921-15592",
    "name": "FULENA YADAV",
    "beneficiaryName": "FULENA YADAV",
    "campaign": "Test Campaign",
    "dueDate": "20-09-2026",
    "status": "Delayed",
    "timeAgo": "3 w",
    "comments": 0,
    "hasHeart": false
  },
  {
    "id": "260921-15593",
    "name": "DILIP SINGH",
    "beneficiaryName": "DILIP SINGH",
    "campaign": "Test Campaign",
    "dueDate": "20-09-2026",
    "status": "Delayed",
    "timeAgo": "3 w",
    "comments": 0,
    "hasHeart": false
  },
  {
    "id": "260921-15594",
    "name": "DEEPAK LODH",
    "beneficiaryName": "DEEPAK LODH",
    "campaign": "Test Campaign",
    "dueDate": "20-09-2026",
    "status": "Delayed",
    "timeAgo": "1 M",
    "comments": 0,
    "hasHeart": false
  },
  {
    "id": "260921-15595",
    "name": "BASAN GURIYA",
    "beneficiaryName": "BASAN GURIYA",
    "campaign": "Test Campaign",
    "dueDate": "20-09-2026",
    "status": "Delayed",
    "timeAgo": "1 M",
    "comments": 0,
    "hasHeart": false
  },
  {
    "id": "260921-15596",
    "name": "ARAN JHARA",
    "beneficiaryName": "ARAN JHARA",
    "campaign": "Test Campaign",
    "dueDate": "20-09-2026",
    "status": "Delayed",
    "timeAgo": "1 M",
    "comments": 0,
    "hasHeart": false
  },
  {
    "id": "260921-15597",
    "name": "AJIT CHETIA",
    "beneficiaryName": "AJIT CHETIA",
    "campaign": "Test Campaign",
    "dueDate": "20-09-2026",
    "status": "Delayed",
    "timeAgo": "1 M",
    "comments": 0,
    "hasHeart": false
  },
  {
    "id": "260921-15598",
    "name": "DEBESWAR CHANGMAI",
    "beneficiaryName": "DEBESWAR CHANGMAI",
    "campaign": "Test Campaign",
    "dueDate": "20-09-2026",
    "status": "Delayed",
    "timeAgo": "3 w",
    "comments": 0,
    "hasHeart": false
  },
  {
    "id": "260921-15599",
    "name": "BULU SHARMA",
    "beneficiaryName": "BULU SHARMA",
    "campaign": "Test Campaign",
    "dueDate": "20-09-2026",
    "status": "Delayed",
    "timeAgo": "3 w",
    "comments": 0,
    "hasHeart": false
  },
  {
    "id": "260921-15600",
    "name": "BISWAJIT BHATTACHARJEE",
    "beneficiaryName": "BISWAJIT BHATTACHARJEE",
    "campaign": "Test Campaign",
    "dueDate": "20-09-2026",
    "status": "Delayed",
    "timeAgo": "3 w",
    "comments": 0,
    "hasHeart": true
  },
  {
    "id": "260921-15601",
    "name": "SUMIT TALUKDAR",
    "beneficiaryName": "SUMIT TALUKDAR",
    "campaign": "Test Campaign",
    "dueDate": "20-09-2026",
    "status": "Delayed",
    "timeAgo": "1 M",
    "comments": 0,
    "hasHeart": false
  },
  {
    "id": "260921-15602",
    "name": "REKHA KALITA",
    "beneficiaryName": "REKHA KALITA",
    "campaign": "Test Campaign",
    "dueDate": "20-09-2026",
    "status": "Delayed",
    "timeAgo": "1 M",
    "comments": 0,
    "hasHeart": true
  },
  {
    "id": "260921-15603",
    "name": "RAMESH KALITA",
    "beneficiaryName": "RAMESH KALITA",
    "campaign": "Test Campaign",
    "dueDate": "30-10-2026",
    "status": "Open",
    "timeAgo": "2 d",
    "comments": 0,
    "hasHeart": false
  },
  {
    "id": "260921-15604",
    "name": "PRIYA DAS",
    "beneficiaryName": "PRIYA DAS",
    "campaign": "Test Campaign",
    "dueDate": "30-10-2026",
    "status": "Open",
    "timeAgo": "3 d",
    "comments": 1,
    "hasHeart": true
  },
  {
    "id": "260921-15605",
    "name": "SUNIL GOGOI",
    "beneficiaryName": "SUNIL GOGOI",
    "campaign": "Test Campaign",
    "dueDate": "30-10-2026",
    "status": "Open",
    "timeAgo": "4 d",
    "comments": 0,
    "hasHeart": false
  },
  {
    "id": "260921-15606",
    "name": "ANITA DEVI",
    "beneficiaryName": "ANITA DEVI",
    "campaign": "Test Campaign",
    "dueDate": "30-10-2026",
    "status": "Open",
    "timeAgo": "5 d",
    "comments": 0,
    "hasHeart": true
  },
  {
    "id": "260921-15607",
    "name": "MANOJ SAIKIA",
    "beneficiaryName": "MANOJ SAIKIA",
    "campaign": "Test Campaign",
    "dueDate": "30-10-2026",
    "status": "Open",
    "timeAgo": "1 d",
    "comments": 0,
    "hasHeart": false
  },
  {
    "id": "260921-15608",
    "name": "RUNU BEGUM",
    "beneficiaryName": "RUNU BEGUM",
    "campaign": "Test Campaign",
    "dueDate": "30-10-2026",
    "status": "Open",
    "timeAgo": "2 d",
    "comments": 0,
    "hasHeart": true
  },
  {
    "id": "260921-15609",
    "name": "HAREN CHOUDHURY",
    "beneficiaryName": "HAREN CHOUDHURY",
    "campaign": "Test Campaign",
    "dueDate": "20-09-2026",
    "status": "Cancelled",
    "timeAgo": "1 M",
    "comments": 0,
    "hasHeart": false
  },
  {
    "id": "260921-15610",
    "name": "MINA BEGUM",
    "beneficiaryName": "MINA BEGUM",
    "campaign": "Test Campaign",
    "dueDate": "15-05-2026",
    "status": "Cancelled",
    "timeAgo": "2 M",
    "comments": 0,
    "hasHeart": true
  }
];

// 2. Randomized Demo Campaigns (completely distinct from screenshot as requested)
const DEMO_CAMPAIGNS = [
  {
    id: "CMP-01",
    name: "Maternal Health & Nutrition Outreach Mission",
    status: "Enabled",
    startDate: "12-10-2026",
    endDate: "30-11-2026",
    center: "Assam Central Hub",
    timeAgo: "1 d",
    comments: 0,
    hasHeart: false,
  },
  {
    id: "CMP-02",
    name: "Rural Diabetes & Hypertension Early Detection",
    status: "Enabled",
    startDate: "05-10-2026",
    endDate: "15-12-2026",
    center: "Guwahati Community Clinic",
    timeAgo: "2 w",
    comments: 0,
    hasHeart: false,
  },
  {
    id: "CMP-03",
    name: "Elderly Geriatric Care & Mobility Assistance Drive",
    status: "Enabled",
    startDate: "28-09-2026",
    endDate: "31-10-2026",
    center: "Silchar Regional Center",
    timeAgo: "3 w",
    comments: 0,
    hasHeart: false,
  },
  {
    id: "CMP-04",
    name: "Pediatric Immunization Awareness & Catch-up Camp",
    status: "Disabled",
    startDate: "15-09-2026",
    endDate: "30-09-2026",
    center: "Jorhat District Facility",
    timeAgo: "1 M",
    comments: 0,
    hasHeart: false,
  },
  {
    id: "CMP-05",
    name: "Community Eye Care & Refraction Screening",
    status: "Enabled",
    startDate: "10-09-2026",
    endDate: "20-11-2026",
    center: "Dibrugarh Outreach Unit",
    timeAgo: "1 M",
    comments: 0,
    hasHeart: false,
  },
  {
    id: "CMP-06",
    name: "Adolescent Anemia & Hemoglobin Testing Initiative",
    status: "Disabled",
    startDate: "01-09-2026",
    endDate: "25-09-2026",
    center: "Tezpur Healthcare Center",
    timeAgo: "1 M",
    comments: 0,
    hasHeart: false,
  },
  {
    id: "CMP-07",
    name: "Tele-Consultation Primary Care Follow-up Program",
    status: "Enabled",
    startDate: "25-08-2026",
    endDate: "10-12-2026",
    center: "Nagaon Telemedicine Center",
    timeAgo: "2 M",
    comments: 0,
    hasHeart: false,
  },
  {
    id: "CMP-08",
    name: "Non-Communicable Disease (NCD) Comprehensive Survey",
    status: "Disabled",
    startDate: "15-08-2026",
    endDate: "30-08-2026",
    center: "Tinsukia Medical Station",
    timeAgo: "2 M",
    comments: 0,
    hasHeart: false,
  },
  {
    id: "CMP-09",
    name: "Post-Natal Care & Neonatal Home Visit Protocol",
    status: "Disabled",
    startDate: "01-08-2026",
    endDate: "20-08-2026",
    center: "Bongaigaon Health Station",
    timeAgo: "2 M",
    comments: 0,
    hasHeart: false,
  },
  {
    id: "CMP-10",
    name: "Digital Health Card Enrollment & Verification Drive",
    status: "Disabled",
    startDate: "20-07-2026",
    endDate: "05-08-2026",
    center: "Barpeta Civic Hospital",
    timeAgo: "3 M",
    comments: 0,
    hasHeart: false,
  },
];

// 3. Demo Data for Beneficiaries by Campaign Bar Chart (Exact 26 bars with explicit pixel heights)
const CHART_BARS = [
  { label: "No..", val: "3.7K", heightPx: 64 },
  { label: "1..", val: "2.5K", heightPx: 46 },
  { label: "1..", val: "2K", heightPx: 38 },
  { label: "2..", val: "822", heightPx: 20 },
  { label: "1..", val: "990", heightPx: 24 },
  { label: "Tr..", val: "159", heightPx: 12 },
  { label: "", val: "1", heightPx: 5 },
  { label: "Pr..", val: "8.8K", heightPx: 148 },
  { label: "", val: "1", heightPx: 5 },
  { label: "Ou..", val: "564", heightPx: 18 },
  { label: "e-..", val: "31", heightPx: 7 },
  { label: "Me..", val: "562", heightPx: 18 },
  { label: "QR..", val: "190", heightPx: 11 },
  { label: "OU..", val: "174", heightPx: 11 },
  { label: "OU..", val: "163", heightPx: 10 },
  { label: "ES..", val: "8.8K", heightPx: 148 },
  { label: "OU..", val: "651", heightPx: 20 },
  { label: "OU..", val: "115", heightPx: 9 },
  { label: "OU..", val: "90", heightPx: 8 },
  { label: "OU..", val: "82", heightPx: 8 },
  { label: "ES..", val: "0", heightPx: 4 },
  { label: "ES..", val: "0", heightPx: 4 },
  { label: "OU..", val: "95", heightPx: 8 },
  { label: "OU..", val: "310", heightPx: 14 },
  { label: "Ch..", val: "3", heightPx: 5 },
  { label: "Tr..", val: "2", heightPx: 5 },
];

const STATUS_OPTIONS = ["Open", "Closed", "Cancelled", "Delayed"];

export const ASSAM_DISTRICTS = [
  "Baksa",
  "Barpeta",
  "Biswanath",
  "Bongaigaon",
  "Cachar",
  "Charaideo",
  "Chirang",
  "Darrang",
  "Dhemaji",
  "Dhubri",
  "Dibrugarh",
  "Dima Hasao",
  "Goalpara",
  "Golaghat",
  "Hailakandi",
  "Hojai",
  "Jorhat",
  "Kamrup",
  "Kamrup Metro",
  "Karbi Anglong",
  "Karimganj",
  "Kokrajhar",
  "Lakhimpur",
  "Majuli",
  "Morigaon",
  "Nagaon",
  "Nalbari",
  "Sivasagar",
  "Sonitpur",
  "South Salmara-Mankachar",
  "Tamulpur",
  "Tinsukia",
  "Udalguri",
  "West Karbi Anglong",
  "Bajali",
];

export const ASSAM_DISTRICT_DEFAULT_PINS = {
  "BAKSA": "781372",
  "BARPETA": "781301",
  "BISWANATH": "784176",
  "BONGAIGAON": "783380",
  "CACHAR": "788001",
  "CHARAIDEO": "785690",
  "CHIRANG": "783385",
  "DARRANG": "784125",
  "DHEMAJI": "787057",
  "DHUBRI": "783301",
  "DIBRUGARH": "786001",
  "DIMA HASAO": "788819",
  "GOALPARA": "783101",
  "GOLAGHAT": "785621",
  "HAILAKANDI": "788151",
  "HOJAI": "782435",
  "JORHAT": "785001",
  "KAMRUP": "781101",
  "KAMRUP METROPOLITAN": "781001",
  "KAMRUP METRO": "781001",
  "KARBI ANGLONG": "782460",
  "KARIMGANJ": "788710",
  "KOKRAJHAR": "783370",
  "LAKHIMPUR": "787001",
  "MAJULI": "785104",
  "MARIGAON": "782105",
  "MORIGAON": "782105",
  "NAGAON": "782001",
  "NALBARI": "781335",
  "SIVASAGAR": "785640",
  "SONITPUR": "784001",
  "SOUTH SALMARA-MANKACHAR": "783127",
  "SOUTH SALMARA MANCACHAR": "783127",
  "TAMULPUR": "781367",
  "TINSUKIA": "786125",
  "UDALGURI": "784509",
  "WEST KARBI ANGLONG": "782448",
  "BAJALI": "781325",
};

// 4. Real Beneficiary Records from Frappe CRM (all 32 task beneficiaries with realistic Assam districts & phone numbers)
const DEMO_BENEFICIARIES = [
  {
    "id": "260921-15571",
    "beneficiaryId": "260921-15571",
    "fullName": "KHEM BAHADUR SONAR",
    "firstName": "KHEM BAHADUR",
    "lastName": "SONAR",
    "state": "Assam",
    "center": "Asam Center 1",
    "phoneNumber": "+91 98451 23456",
    "cleanPhone": "9845123456",
    "district": "Baksa",
    "branching": "Child",
    "registrationDate": "15-05-2026 10:00",
    "gender": "Male",
    "age": "36",
    "pinCode": "781372",
    "block": "Baksa",
    "village": "Musalpur",
    "typeOfContact": "Self",
    "ipNumber": "4300000000",
    "parent": "KHEM BAHADUR SONAR",
    "employerName": "ESIC Assam",
    "timeAgo": "3 w",
    "comments": 0,
    "hasHeart": false
  },
  {
    "id": "260921-15572",
    "beneficiaryId": "260921-15572",
    "fullName": "AJIT BORA-1",
    "firstName": "AJIT",
    "lastName": "BORA-1",
    "state": "Assam",
    "center": "Asam Center 1",
    "phoneNumber": "+91 97123 45678",
    "cleanPhone": "9712345678",
    "district": "Barpeta",
    "branching": "Child",
    "registrationDate": "30-08-2026 10:00",
    "gender": "Male",
    "age": "42",
    "pinCode": "781301",
    "block": "Barpeta",
    "village": "Barpeta Town",
    "typeOfContact": "Self",
    "ipNumber": "4300000000",
    "parent": "AJIT BORA-1",
    "employerName": "ESIC Assam",
    "timeAgo": "3 w",
    "comments": 0,
    "hasHeart": false
  },
  {
    "id": "260921-15573",
    "beneficiaryId": "260921-15573",
    "fullName": "BIJAY KR. RAI",
    "firstName": "BIJAY KR.",
    "lastName": "RAI",
    "state": "Assam",
    "center": "Asam Center 1",
    "phoneNumber": "+91 98640 12984",
    "cleanPhone": "9864012984",
    "district": "Biswanath",
    "branching": "Child",
    "registrationDate": "15-05-2026 10:00",
    "gender": "Male",
    "age": "39",
    "pinCode": "784176",
    "block": "Biswanath Chariali",
    "village": "Biswanath",
    "typeOfContact": "Self",
    "ipNumber": "4300000000",
    "parent": "BIJAY KR. RAI",
    "employerName": "ESIC Assam",
    "timeAgo": "3 w",
    "comments": 0,
    "hasHeart": false
  },
  {
    "id": "260921-15574",
    "beneficiaryId": "260921-15574",
    "fullName": "Bharat Kumar Sah",
    "firstName": "Bharat Kumar",
    "lastName": "Sah",
    "state": "Assam",
    "center": "Asam Center 1",
    "phoneNumber": "+91 94350 81273",
    "cleanPhone": "9435081273",
    "district": "Bongaigaon",
    "branching": "Child",
    "registrationDate": "30-08-2026 10:00",
    "gender": "Male",
    "age": "45",
    "pinCode": "783380",
    "block": "Bongaigaon",
    "village": "Birjhora",
    "typeOfContact": "Self",
    "ipNumber": "4300000000",
    "parent": "Bharat Kumar Sah",
    "employerName": "ESIC Assam",
    "timeAgo": "1 M",
    "comments": 0,
    "hasHeart": false
  },
  {
    "id": "260921-15575",
    "beneficiaryId": "260921-15575",
    "fullName": "BASAN GURIYA",
    "firstName": "BASAN",
    "lastName": "GURIYA",
    "state": "Assam",
    "center": "Asam Center 1",
    "phoneNumber": "+91 99540 23190",
    "cleanPhone": "9954023190",
    "district": "Cachar",
    "branching": "Child",
    "registrationDate": "15-05-2026 10:00",
    "gender": "Male",
    "age": "34",
    "pinCode": "788001",
    "block": "Silchar",
    "village": "Rangpur",
    "typeOfContact": "Self",
    "ipNumber": "4300000000",
    "parent": "BASAN GURIYA",
    "employerName": "ESIC Assam",
    "timeAgo": "1 M",
    "comments": 0,
    "hasHeart": false
  },
  {
    "id": "260921-15576",
    "beneficiaryId": "260921-15576",
    "fullName": "BAHADUR BINJUWAR",
    "firstName": "BAHADUR",
    "lastName": "BINJUWAR",
    "state": "Assam",
    "center": "Asam Center 1",
    "phoneNumber": "+91 97061 45829",
    "cleanPhone": "9706145829",
    "district": "Charaideo",
    "branching": "Child",
    "registrationDate": "30-08-2026 10:00",
    "gender": "Male",
    "age": "51",
    "pinCode": "785690",
    "block": "Sonari",
    "village": "Charaideo",
    "typeOfContact": "Self",
    "ipNumber": "4300000000",
    "parent": "BAHADUR BINJUWAR",
    "employerName": "ESIC Assam",
    "timeAgo": "1 M",
    "comments": 0,
    "hasHeart": false
  },
  {
    "id": "260921-15577",
    "beneficiaryId": "260921-15577",
    "fullName": "ATUL RAY",
    "firstName": "ATUL",
    "lastName": "RAY",
    "state": "Assam",
    "center": "Asam Center 1",
    "phoneNumber": "+91 91012 39841",
    "cleanPhone": "9101239841",
    "district": "Chirang",
    "branching": "Child",
    "registrationDate": "15-05-2026 10:00",
    "gender": "Male",
    "age": "29",
    "pinCode": "783385",
    "block": "Kajalgaon",
    "village": "Bijni",
    "typeOfContact": "Self",
    "ipNumber": "4300000000",
    "parent": "ATUL RAY",
    "employerName": "ESIC Assam",
    "timeAgo": "1 M",
    "comments": 0,
    "hasHeart": false
  },
  {
    "id": "260921-15578",
    "beneficiaryId": "260921-15578",
    "fullName": "ARUP RAJKONWAR",
    "firstName": "ARUP",
    "lastName": "RAJKONWAR",
    "state": "Assam",
    "center": "Asam Center 1",
    "phoneNumber": "+91 88765 41209",
    "cleanPhone": "8876541209",
    "district": "Darrang",
    "branching": "Child",
    "registrationDate": "30-08-2026 10:00",
    "gender": "Male",
    "age": "38",
    "pinCode": "784125",
    "block": "Mangaldai",
    "village": "Sipajhar",
    "typeOfContact": "Self",
    "ipNumber": "4300000000",
    "parent": "ARUP RAJKONWAR",
    "employerName": "ESIC Assam",
    "timeAgo": "3 w",
    "comments": 0,
    "hasHeart": false
  },
  {
    "id": "260921-15579",
    "beneficiaryId": "260921-15579",
    "fullName": "ARAN JHARA",
    "firstName": "ARAN",
    "lastName": "JHARA",
    "state": "Assam",
    "center": "Asam Center 1",
    "phoneNumber": "+91 70021 34598",
    "cleanPhone": "7002134598",
    "district": "Dhemaji",
    "branching": "Child",
    "registrationDate": "15-05-2026 10:00",
    "gender": "Male",
    "age": "33",
    "pinCode": "787057",
    "block": "Dhemaji",
    "village": "Silapathar",
    "typeOfContact": "Self",
    "ipNumber": "4300000000",
    "parent": "ARAN JHARA",
    "employerName": "ESIC Assam",
    "timeAgo": "3 w",
    "comments": 0,
    "hasHeart": false
  },
  {
    "id": "260921-15580",
    "beneficiaryId": "260921-15580",
    "fullName": "ANIMA NATH",
    "firstName": "ANIMA",
    "lastName": "NATH",
    "state": "Assam",
    "center": "Asam Center 1",
    "phoneNumber": "+91 60023 45109",
    "cleanPhone": "6002345109",
    "district": "Dhubri",
    "branching": "Child",
    "registrationDate": "30-08-2026 10:00",
    "gender": "Female",
    "age": "28",
    "pinCode": "783301",
    "block": "Gauripur",
    "village": "Dhubri Town",
    "typeOfContact": "Self",
    "ipNumber": "4300000000",
    "parent": "ANIMA NATH",
    "employerName": "ESIC Assam",
    "timeAgo": "3 w",
    "comments": 0,
    "hasHeart": true
  },
  {
    "id": "260921-15581",
    "beneficiaryId": "260921-15581",
    "fullName": "ANIL BARMAN",
    "firstName": "ANIL",
    "lastName": "BARMAN",
    "state": "Assam",
    "center": "Asam Center 1",
    "phoneNumber": "+91 86381 29405",
    "cleanPhone": "8638129405",
    "district": "Dibrugarh",
    "branching": "Child",
    "registrationDate": "15-05-2026 10:00",
    "gender": "Male",
    "age": "47",
    "pinCode": "786001",
    "block": "Dibrugarh",
    "village": "Chowkidinghee",
    "typeOfContact": "Self",
    "ipNumber": "4300000000",
    "parent": "ANIL BARMAN",
    "employerName": "ESIC Assam",
    "timeAgo": "1 M",
    "comments": 0,
    "hasHeart": false
  },
  {
    "id": "260921-15582",
    "beneficiaryId": "260921-15582",
    "fullName": "AMAR DAHA",
    "firstName": "AMAR",
    "lastName": "DAHA",
    "state": "Assam",
    "center": "Asam Center 1",
    "phoneNumber": "+91 94351 23890",
    "cleanPhone": "9435123890",
    "district": "Dima Hasao",
    "branching": "Child",
    "registrationDate": "30-08-2026 10:00",
    "gender": "Male",
    "age": "31",
    "pinCode": "788819",
    "block": "Haflong",
    "village": "Haflong Hill",
    "typeOfContact": "Self",
    "ipNumber": "4300000000",
    "parent": "AMAR DAHA",
    "employerName": "ESIC Assam",
    "timeAgo": "1 M",
    "comments": 0,
    "hasHeart": false
  },
  {
    "id": "260921-15583",
    "beneficiaryId": "260921-15583",
    "fullName": "ALISHA BEGUM",
    "firstName": "ALISHA",
    "lastName": "BEGUM",
    "state": "Assam",
    "center": "Asam Center 1",
    "phoneNumber": "+91 98642 01934",
    "cleanPhone": "9864201934",
    "district": "Goalpara",
    "branching": "Child",
    "registrationDate": "15-05-2026 10:00",
    "gender": "Female",
    "age": "26",
    "pinCode": "783101",
    "block": "Goalpara",
    "village": "Baladmari",
    "typeOfContact": "Self",
    "ipNumber": "4300000000",
    "parent": "ALISHA BEGUM",
    "employerName": "ESIC Assam",
    "timeAgo": "2 w",
    "comments": 0,
    "hasHeart": false
  },
  {
    "id": "260921-15584",
    "beneficiaryId": "260921-15584",
    "fullName": "PRABHAT BORAH",
    "firstName": "PRABHAT",
    "lastName": "BORAH",
    "state": "Assam",
    "center": "Asam Center 1",
    "phoneNumber": "+91 97071 23849",
    "cleanPhone": "9707123849",
    "district": "Golaghat",
    "branching": "Child",
    "registrationDate": "30-08-2026 10:00",
    "gender": "Male",
    "age": "54",
    "pinCode": "785621",
    "block": "Bokakhat",
    "village": "Kaziranga",
    "typeOfContact": "Self",
    "ipNumber": "4300000000",
    "parent": "PRABHAT BORAH",
    "employerName": "ESIC Assam",
    "timeAgo": "1 M",
    "comments": 0,
    "hasHeart": true
  },
  {
    "id": "260921-15585",
    "beneficiaryId": "260921-15585",
    "fullName": "DILIP SINGH",
    "firstName": "DILIP",
    "lastName": "SINGH",
    "state": "Assam",
    "center": "Asam Center 1",
    "phoneNumber": "+91 99571 20945",
    "cleanPhone": "9957120945",
    "district": "Hailakandi",
    "branching": "Child",
    "registrationDate": "15-05-2026 10:00",
    "gender": "Male",
    "age": "48",
    "pinCode": "788151",
    "block": "Lala",
    "village": "Hailakandi Town",
    "typeOfContact": "Self",
    "ipNumber": "4300000000",
    "parent": "DILIP SINGH",
    "employerName": "ESIC Assam",
    "timeAgo": "3 w",
    "comments": 0,
    "hasHeart": false
  },
  {
    "id": "260921-15586",
    "beneficiaryId": "260921-15586",
    "fullName": "DEEPAK LODH",
    "firstName": "DEEPAK",
    "lastName": "LODH",
    "state": "Assam",
    "center": "Asam Center 1",
    "phoneNumber": "+91 91018 94231",
    "cleanPhone": "9101894231",
    "district": "Hojai",
    "branching": "Child",
    "registrationDate": "30-08-2026 10:00",
    "gender": "Male",
    "age": "37",
    "pinCode": "782435",
    "block": "Hojai",
    "village": "Lumding",
    "typeOfContact": "Self",
    "ipNumber": "4300000000",
    "parent": "DEEPAK LODH",
    "employerName": "ESIC Assam",
    "timeAgo": "1 M",
    "comments": 0,
    "hasHeart": false
  },
  {
    "id": "260921-15587",
    "beneficiaryId": "260921-15587",
    "fullName": "DEBESWAR CHANGMAI",
    "firstName": "DEBESWAR",
    "lastName": "CHANGMAI",
    "state": "Assam",
    "center": "Asam Center 1",
    "phoneNumber": "+91 88761 29840",
    "cleanPhone": "8876129840",
    "district": "Jorhat",
    "branching": "Child",
    "registrationDate": "15-05-2026 10:00",
    "gender": "Male",
    "age": "43",
    "pinCode": "785001",
    "block": "Jorhat",
    "village": "Titabar",
    "typeOfContact": "Self",
    "ipNumber": "4300000000",
    "parent": "DEBESWAR CHANGMAI",
    "employerName": "ESIC Assam",
    "timeAgo": "3 w",
    "comments": 0,
    "hasHeart": false
  },
  {
    "id": "260921-15588",
    "beneficiaryId": "260921-15588",
    "fullName": "BULU SHARMA",
    "firstName": "BULU",
    "lastName": "SHARMA",
    "state": "Assam",
    "center": "Asam Center 1",
    "phoneNumber": "+91 70028 91234",
    "cleanPhone": "7002891234",
    "district": "Kamrup",
    "branching": "Child",
    "registrationDate": "30-08-2026 10:00",
    "gender": "Male",
    "age": "35",
    "pinCode": "781030",
    "block": "Rangia",
    "village": "Hajo",
    "typeOfContact": "Self",
    "ipNumber": "4300000000",
    "parent": "BULU SHARMA",
    "employerName": "ESIC Assam",
    "timeAgo": "3 w",
    "comments": 0,
    "hasHeart": false
  },
  {
    "id": "260921-15589",
    "beneficiaryId": "260921-15589",
    "fullName": "BISWAJIT BHATTACHARJEE",
    "firstName": "BISWAJIT",
    "lastName": "BHATTACHARJEE",
    "state": "Assam",
    "center": "Asam Center 1",
    "phoneNumber": "+91 60029 81245",
    "cleanPhone": "6002981245",
    "district": "Kamrup Metro",
    "branching": "Child",
    "registrationDate": "15-05-2026 10:00",
    "gender": "Male",
    "age": "40",
    "pinCode": "781001",
    "block": "Dispur",
    "village": "Guwahati",
    "typeOfContact": "Self",
    "ipNumber": "4300000000",
    "parent": "BISWAJIT BHATTACHARJEE",
    "employerName": "ESIC Assam",
    "timeAgo": "3 w",
    "comments": 0,
    "hasHeart": true
  },
  {
    "id": "260921-15590",
    "beneficiaryId": "260921-15590",
    "fullName": "MAYA BARUA",
    "firstName": "MAYA",
    "lastName": "BARUA",
    "state": "Assam",
    "center": "Asam Center 1",
    "phoneNumber": "+91 86389 01243",
    "cleanPhone": "8638901243",
    "district": "Karbi Anglong",
    "branching": "Child",
    "registrationDate": "30-08-2026 10:00",
    "gender": "Female",
    "age": "32",
    "pinCode": "782460",
    "block": "Diphu",
    "village": "Diphu Bazar",
    "typeOfContact": "Self",
    "ipNumber": "4300000000",
    "parent": "MAYA BARUA",
    "employerName": "ESIC Assam",
    "timeAgo": "3 w",
    "comments": 0,
    "hasHeart": false
  },
  {
    "id": "260921-15592",
    "beneficiaryId": "260921-15592",
    "fullName": "FULENA YADAV",
    "firstName": "FULENA",
    "lastName": "YADAV",
    "state": "Assam",
    "center": "Asam Center 1",
    "phoneNumber": "+91 98456 12349",
    "cleanPhone": "9845612349",
    "district": "Karimganj",
    "branching": "Child",
    "registrationDate": "20-09-2026 10:00",
    "gender": "Male",
    "age": "46",
    "pinCode": "788710",
    "block": "Badarpur",
    "village": "Karimganj Town",
    "typeOfContact": "Self",
    "ipNumber": "4300000000",
    "parent": "FULENA YADAV",
    "employerName": "ESIC Assam",
    "timeAgo": "3 w",
    "comments": 0,
    "hasHeart": false
  },
  {
    "id": "260921-15597",
    "beneficiaryId": "260921-15597",
    "fullName": "AJIT CHETIA",
    "firstName": "AJIT",
    "lastName": "CHETIA",
    "state": "Assam",
    "center": "Asam Center 1",
    "phoneNumber": "+91 97128 93450",
    "cleanPhone": "9712893450",
    "district": "Kokrajhar",
    "branching": "Child",
    "registrationDate": "20-09-2026 10:00",
    "gender": "Male",
    "age": "37",
    "pinCode": "783370",
    "block": "Kokrajhar",
    "village": "Gossaigaon",
    "typeOfContact": "Self",
    "ipNumber": "4300000000",
    "parent": "AJIT CHETIA",
    "employerName": "ESIC Assam",
    "timeAgo": "1 M",
    "comments": 0,
    "hasHeart": false
  },
  {
    "id": "260921-15601",
    "beneficiaryId": "260921-15601",
    "fullName": "SUMIT TALUKDAR",
    "firstName": "SUMIT",
    "lastName": "TALUKDAR",
    "state": "Assam",
    "center": "Asam Center 1",
    "phoneNumber": "+91 98648 91203",
    "cleanPhone": "9864891203",
    "district": "Lakhimpur",
    "branching": "Child",
    "registrationDate": "20-09-2026 10:00",
    "gender": "Male",
    "age": "30",
    "pinCode": "787001",
    "block": "North Lakhimpur",
    "village": "Bihpuria",
    "typeOfContact": "Self",
    "ipNumber": "4300000000",
    "parent": "SUMIT TALUKDAR",
    "employerName": "ESIC Assam",
    "timeAgo": "1 M",
    "comments": 0,
    "hasHeart": false
  },
  {
    "id": "260921-15602",
    "beneficiaryId": "260921-15602",
    "fullName": "REKHA KALITA",
    "firstName": "REKHA",
    "lastName": "KALITA",
    "state": "Assam",
    "center": "Asam Center 1",
    "phoneNumber": "+91 94358 91230",
    "cleanPhone": "9435891230",
    "district": "Majuli",
    "branching": "Child",
    "registrationDate": "20-09-2026 10:00",
    "gender": "Female",
    "age": "29",
    "pinCode": "785104",
    "block": "Garmur",
    "village": "Kamalabari",
    "typeOfContact": "Self",
    "ipNumber": "4300000000",
    "parent": "REKHA KALITA",
    "employerName": "ESIC Assam",
    "timeAgo": "1 M",
    "comments": 0,
    "hasHeart": true
  },
  {
    "id": "260921-15603",
    "beneficiaryId": "260921-15603",
    "fullName": "RAMESH KALITA",
    "firstName": "RAMESH",
    "lastName": "KALITA",
    "state": "Assam",
    "center": "Asam Center 1",
    "phoneNumber": "+91 99548 91203",
    "cleanPhone": "9954891203",
    "district": "Morigaon",
    "branching": "Child",
    "registrationDate": "30-10-2026 10:00",
    "gender": "Male",
    "age": "41",
    "pinCode": "782105",
    "block": "Morigaon",
    "village": "Jagiroad",
    "typeOfContact": "Self",
    "ipNumber": "4300000000",
    "parent": "RAMESH KALITA",
    "employerName": "ESIC Assam",
    "timeAgo": "2 d",
    "comments": 0,
    "hasHeart": false
  },
  {
    "id": "260921-15604",
    "beneficiaryId": "260921-15604",
    "fullName": "PRIYA DAS",
    "firstName": "PRIYA",
    "lastName": "DAS",
    "state": "Assam",
    "center": "Asam Center 1",
    "phoneNumber": "+91 97068 91234",
    "cleanPhone": "9706891234",
    "district": "Nagaon",
    "branching": "Child",
    "registrationDate": "30-10-2026 10:00",
    "gender": "Female",
    "age": "27",
    "pinCode": "782001",
    "block": "Nagaon",
    "village": "Raha",
    "typeOfContact": "Self",
    "ipNumber": "4300000000",
    "parent": "PRIYA DAS",
    "employerName": "ESIC Assam",
    "timeAgo": "3 d",
    "comments": 1,
    "hasHeart": true
  },
  {
    "id": "260921-15605",
    "beneficiaryId": "260921-15605",
    "fullName": "SUNIL GOGOI",
    "firstName": "SUNIL",
    "lastName": "GOGOI",
    "state": "Assam",
    "center": "Asam Center 1",
    "phoneNumber": "+91 91017 82390",
    "cleanPhone": "9101782390",
    "district": "Nalbari",
    "branching": "Child",
    "registrationDate": "30-10-2026 10:00",
    "gender": "Male",
    "age": "34",
    "pinCode": "781335",
    "block": "Nalbari",
    "village": "Tihu",
    "typeOfContact": "Self",
    "ipNumber": "4300000000",
    "parent": "SUNIL GOGOI",
    "employerName": "ESIC Assam",
    "timeAgo": "4 d",
    "comments": 0,
    "hasHeart": false
  },
  {
    "id": "260921-15606",
    "beneficiaryId": "260921-15606",
    "fullName": "ANITA DEVI",
    "firstName": "ANITA",
    "lastName": "DEVI",
    "state": "Assam",
    "center": "Asam Center 1",
    "phoneNumber": "+91 88768 91234",
    "cleanPhone": "8876891234",
    "district": "Sivasagar",
    "branching": "Child",
    "registrationDate": "30-10-2026 10:00",
    "gender": "Female",
    "age": "31",
    "pinCode": "785640",
    "block": "Sivasagar",
    "village": "Nazira",
    "typeOfContact": "Self",
    "ipNumber": "4300000000",
    "parent": "ANITA DEVI",
    "employerName": "ESIC Assam",
    "timeAgo": "5 d",
    "comments": 0,
    "hasHeart": true
  },
  {
    "id": "260921-15607",
    "beneficiaryId": "260921-15607",
    "fullName": "MANOJ SAIKIA",
    "firstName": "MANOJ",
    "lastName": "SAIKIA",
    "state": "Assam",
    "center": "Asam Center 1",
    "phoneNumber": "+91 70027 81290",
    "cleanPhone": "7002781290",
    "district": "Sonitpur",
    "branching": "Child",
    "registrationDate": "30-10-2026 10:00",
    "gender": "Male",
    "age": "44",
    "pinCode": "784001",
    "block": "Tezpur",
    "village": "Dhekiajuli",
    "typeOfContact": "Self",
    "ipNumber": "4300000000",
    "parent": "MANOJ SAIKIA",
    "employerName": "ESIC Assam",
    "timeAgo": "1 d",
    "comments": 0,
    "hasHeart": false
  },
  {
    "id": "260921-15608",
    "beneficiaryId": "260921-15608",
    "fullName": "RUNU BEGUM",
    "firstName": "RUNU",
    "lastName": "BEGUM",
    "state": "Assam",
    "center": "Asam Center 1",
    "phoneNumber": "+91 60027 81290",
    "cleanPhone": "6002781290",
    "district": "Tinsukia",
    "branching": "Child",
    "registrationDate": "30-10-2026 10:00",
    "gender": "Female",
    "age": "33",
    "pinCode": "786125",
    "block": "Tinsukia",
    "village": "Digboi",
    "typeOfContact": "Self",
    "ipNumber": "4300000000",
    "parent": "RUNU BEGUM",
    "employerName": "ESIC Assam",
    "timeAgo": "2 d",
    "comments": 0,
    "hasHeart": true
  },
  {
    "id": "260921-15609",
    "beneficiaryId": "260921-15609",
    "fullName": "HAREN CHOUDHURY",
    "firstName": "HAREN",
    "lastName": "CHOUDHURY",
    "state": "Assam",
    "center": "Asam Center 1",
    "phoneNumber": "+91 86387 81290",
    "cleanPhone": "8638781290",
    "district": "Udalguri",
    "branching": "Child",
    "registrationDate": "20-09-2026 10:00",
    "gender": "Male",
    "age": "52",
    "pinCode": "784509",
    "block": "Udalguri",
    "village": "Tangla",
    "typeOfContact": "Self",
    "ipNumber": "4300000000",
    "parent": "HAREN CHOUDHURY",
    "employerName": "ESIC Assam",
    "timeAgo": "1 M",
    "comments": 0,
    "hasHeart": false
  },
  {
    "id": "260921-15610",
    "beneficiaryId": "260921-15610",
    "fullName": "MINA BEGUM",
    "firstName": "MINA",
    "lastName": "BEGUM",
    "state": "Assam",
    "center": "Asam Center 1",
    "phoneNumber": "+91 98647 81290",
    "cleanPhone": "9864781290",
    "district": "Kamrup Metro",
    "branching": "Child",
    "registrationDate": "15-05-2026 10:00",
    "gender": "Female",
    "age": "36",
    "pinCode": "781005",
    "block": "Chandmari",
    "village": "Guwahati",
    "typeOfContact": "Self",
    "ipNumber": "4300000000",
    "parent": "MINA BEGUM",
    "employerName": "ESIC Assam",
    "timeAgo": "2 M",
    "comments": 0,
    "hasHeart": true
  }
];

// Filter helper: ONLY genuine calls (excluding blank form opened placeholders) should show in Call History
function filterOnlyCalls(list) {
  if (!Array.isArray(list)) return [];
  return list.filter((item) => {
    if (!item) return false;
    const dur = String(item.duration || "").trim();
    const notes = String(item.notes || "").toLowerCase();
    const st = String(item.status || "").toLowerCase();
    const camp = String(item.campaign || "").toLowerCase();

    // Never show dummy 00:00 placeholders generated purely by opening an empty form without calling
    if ((dur === "00:00" || dur === "0" || !dur) && (notes.includes("form opened") || notes.includes("beneficiary form opened"))) {
      return false;
    }

    // Exclude abandoned / missed calls unless they are part of a real triage case or triage campaign
    if (st.includes("not connected") || notes.includes("no call connected") || st.includes("missed") || item.callConnected === false) {
      if (!item.caseId && !camp.includes("triage")) {
        return false;
      }
    }

    return true;
  });
}

export function CrmIntegratedView({
  initialNav = "CRM Dashboard",
  initialBeneficiaryViewMode = "list",
  initialBeneficiaryId = null,
} = {}) {
  // Navigation active tab: 'CRM Dashboard' | 'Campaigns' | 'Master' | 'Reports' | 'Task List' | 'Beneficiary'
  const [activeNav, setActiveNav] = useState(initialNav);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Beneficiary Page State: 'list' (all beneficiaries) vs 'form' (individual beneficiary detail)
  const [beneficiaryViewMode, setBeneficiaryViewMode] = useState(initialBeneficiaryViewMode);
  const [beneficiaries, setBeneficiaries] = useState(() => {
    if (typeof window !== "undefined") {
      let cached = getCachedCrmBeneficiaries();
      const deleted = (() => {
        try {
          return JSON.parse(localStorage.getItem("crm_deleted_beneficiaries") || "[]");
        } catch (_) {
          return [];
        }
      })();
      const deletedSet = new Set(deleted.map((d) => String(d).trim().toUpperCase()));

      // Filter out any previously deleted records and upgrade old IDs to 260921- format
      cached = cached
        .filter(
          (b) => !deletedSet.has(String(b.id).toUpperCase()) && !deletedSet.has(String(b.fullName || "").trim().toUpperCase())
        )
        .map((b) => {
          if (!b.id || !b.id.startsWith("260921-")) {
            const matchSeed = DEMO_BENEFICIARIES.find(
              (s) => s.fullName?.trim().toUpperCase() === (b.fullName || "").trim().toUpperCase()
            );
            if (matchSeed) {
              return { ...b, id: matchSeed.id, beneficiaryId: matchSeed.id };
            }
          }
          return b;
        });

      // Merge DEMO_BENEFICIARIES if missing and not deleted
      const existingIds = new Set(cached.map((b) => String(b.id).toUpperCase()));
      const existingNames = new Set(cached.map((b) => String(b.fullName || "").trim().toUpperCase()));

      let merged = [...cached];
      let needsCacheUpdate = false;
      DEMO_BENEFICIARIES.forEach((seed) => {
        const sId = String(seed.id).toUpperCase();
        const sName = String(seed.fullName).trim().toUpperCase();
        if (!deletedSet.has(sId) && !deletedSet.has(sName) && !existingIds.has(sId) && !existingNames.has(sName)) {
          merged.push(seed);
          needsCacheUpdate = true;
        }
      });

      if (needsCacheUpdate) {
        setCachedCrmBeneficiaries(merged);
      }
      return merged;
    }
    return DEMO_BENEFICIARIES;
  });

  useEffect(() => {
    // 1. Instant load from local cash memory, merge seed beneficiaries if not deleted
    let cached = getCachedCrmBeneficiaries();
    const deleted = (() => {
      try {
        return JSON.parse(localStorage.getItem("crm_deleted_beneficiaries") || "[]");
      } catch (_) {
        return [];
      }
    })();
    const deletedSet = new Set(deleted.map((d) => String(d).trim().toUpperCase()));

    cached = cached
      .filter(
        (b) => !deletedSet.has(String(b.id).toUpperCase()) && !deletedSet.has(String(b.fullName || "").trim().toUpperCase())
      )
      .map((b) => {
        if (!b.id || !b.id.startsWith("260921-")) {
          const matchSeed = DEMO_BENEFICIARIES.find(
            (s) => s.fullName?.trim().toUpperCase() === (b.fullName || "").trim().toUpperCase()
          );
          if (matchSeed) {
            return { ...b, id: matchSeed.id, beneficiaryId: matchSeed.id };
          }
        }
        return b;
      });

    const existingIds = new Set(cached.map((b) => String(b.id).toUpperCase()));
    const existingNames = new Set(cached.map((b) => String(b.fullName || "").trim().toUpperCase()));

    let merged = [...cached];
    let needsCacheUpdate = false;
    DEMO_BENEFICIARIES.forEach((seed) => {
      const sId = String(seed.id).toUpperCase();
      const sName = String(seed.fullName).trim().toUpperCase();
      if (!deletedSet.has(sId) && !deletedSet.has(sName) && !existingIds.has(sId) && !existingNames.has(sName)) {
        merged.push(seed);
        needsCacheUpdate = true;
      }
    });

    if (merged.length > 0) {
      setBeneficiaries(merged);
      if (needsCacheUpdate) {
        setCachedCrmBeneficiaries(merged);
      }
    }

    // 2. If cash memory is fresh (< 15 mins), DO NOT read Firestore! (0 reads)
    if (merged.length > 0 && isCrmBeneficiariesCacheFresh(15 * 60 * 1000)) {
      return;
    }

    // 3. Only query remote Firestore if cash memory is completely empty or stale
    const loadFromCrmDb = async () => {
      try {
        const crmDb = getCrmFirestoreDb();
        if (!crmDb) return;
        const snapshot = await getDocs(collection(crmDb, "crm_beneficiaries"));
        if (!snapshot.empty) {
          const remoteList = [];
          snapshot.forEach((d) => {
            const data = d.data();
            const bId = String(d.id).toUpperCase();
            const bName = String(data?.fullName || "").trim().toUpperCase();
            if (!deletedSet.has(bId) && !deletedSet.has(bName)) {
              remoteList.push({ id: d.id, ...data });
            }
          });
          setBeneficiaries((prev) => {
            const map = new Map();
            prev.forEach((b) => map.set(b.id || b.beneficiaryId, b));
            remoteList.forEach((b) => map.set(b.id || b.beneficiaryId, b));
            const mergedRem = Array.from(map.values()).filter(
              (b) => !deletedSet.has(String(b.id).toUpperCase()) && !deletedSet.has(String(b.fullName || "").trim().toUpperCase())
            );
            setCachedCrmBeneficiaries(mergedRem);
            return mergedRem;
          });
        }
      } catch (err) {
        console.warn("Could not load from crm_beneficiaries in CRM Firestore:", err);
      }
    };
    loadFromCrmDb();
  }, []);

  // Real-time cross-tab synchronization for beneficiaries (0 Firestore reads)
  useEffect(() => {
    const unsub = subscribeToSync((msg) => {
      if (msg?.type === "CRM_BENEFICIARIES_UPDATED" && Array.isArray(msg?.payload)) {
        setBeneficiaries(msg.payload);
      }
    });
    return () => unsub();
  }, []);
  const [selectedBenIds, setSelectedBenIds] = useState(new Set());
  const [benIdFilter, setBenIdFilter] = useState("");
  const [benPhoneFilter, setBenPhoneFilter] = useState("");
  const [benNameFilter, setBenNameFilter] = useState("");
  const [benDistrictFilter, setBenDistrictFilter] = useState("");
  const [benSortOrder, setBenSortOrder] = useState("desc");
  const [benSortField, setBenSortField] = useState("Created On");
  const [benSortDropdownOpen, setBenSortDropdownOpen] = useState(false);
  const [likedBenIds, setLikedBenIds] = useState(new Set());
  const [benPageSize, setBenPageSize] = useState(20);

  // Beneficiaries / Tasks state (synced with deleted records and persistent registry)
  const [tasks, setTasks] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("crm_tasks_registry");
        const deleted = JSON.parse(localStorage.getItem("crm_deleted_beneficiaries") || "[]");
        const deletedSet = new Set(deleted.map((d) => String(d).trim().toUpperCase()));
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed
              .filter(
                (t) => !deletedSet.has(String(t.id).toUpperCase()) &&
                       !deletedSet.has((t.name || t.beneficiaryName || "").trim().toUpperCase())
              )
              .map((t) => {
                if (!t.id || !t.id.startsWith("260921-")) {
                  const matchTask = DEMO_TASKS.find(
                    (d) => (d.name || d.beneficiaryName || "").trim().toUpperCase() === (t.name || t.beneficiaryName || "").trim().toUpperCase()
                  );
                  if (matchTask) return { ...t, id: matchTask.id };
                }
                return t;
              });
          }
        }
        if (Array.isArray(deleted) && deleted.length > 0) {
          return DEMO_TASKS.filter(
            (t) => !deletedSet.has(String(t.id).toUpperCase()) &&
                   !deletedSet.has((t.name || t.beneficiaryName || "").trim().toUpperCase())
          );
        }
      } catch (_) {}
    }
    return DEMO_TASKS;
  });
  const [statusFilter, setStatusFilter] = useState("Closed");
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);

  // Active Logged-in Agent state (Agent 1, Agent 2, Agent 3, Admin 1, Admin 2)
  const [activeAgentId, setActiveAgentId] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = sessionStorage.getItem("ekms_active_agent") || localStorage.getItem("ekms_active_agent");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed?.agentId) {
            const clean = parsed.agentId.trim().toLowerCase().replace(/\s+/g, "");
            if (clean === "agent1") return "Agent 1";
            if (clean === "agent2") return "Agent 2";
            if (clean === "agent3") return "Agent 3";
            if (clean === "admin1") return "Admin 1";
            if (clean === "admin2") return "Admin 2";
            return parsed.agentId;
          }
        }
      } catch (_) {}
    }
    return "";
  });

  const handleSwitchAgent = (newAgent) => {
    setActiveAgentId(newAgent);
    if (typeof window !== "undefined") {
      try {
        const stored = sessionStorage.getItem("ekms_active_agent") || localStorage.getItem("ekms_active_agent");
        let sessionObj = { agentId: newAgent, sessionId: `sess_${Date.now()}` };
        if (stored) {
          try {
            sessionObj = { ...JSON.parse(stored), agentId: newAgent };
          } catch (_) {}
        }
        const jsonStr = JSON.stringify(sessionObj);
        sessionStorage.setItem("ekms_active_agent", jsonStr);
        localStorage.setItem("ekms_active_agent", jsonStr);
        window.dispatchEvent(new Event("storage"));
        window.dispatchEvent(new Event("ekms_auth_change"));
      } catch (_) {}
    }
    toast.info(`Active account switched to ${newAgent}`);
  };

  // CRM Login persistence state - requires explicit CRM authentication
  const [crmLoggedIn, setCrmLoggedIn] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        if (sessionStorage.getItem("crm_authenticated_session") === "true") {
          return true;
        }
      } catch (_) {}
    }
    return false;
  });

  const [crmLoginId, setCrmLoginId] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = sessionStorage.getItem("ekms_active_agent") || localStorage.getItem("ekms_active_agent");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed?.agentId) {
            const clean = parsed.agentId.trim().toLowerCase().replace(/\s+/g, "");
            if (clean === "agent1") return "Agent 1";
            if (clean === "agent2") return "Agent 2";
            if (clean === "agent3") return "Agent 3";
            if (clean === "admin1") return "Admin 1";
            if (clean === "admin2") return "Admin 2";
            return parsed.agentId;
          }
        }
      } catch (_) {}
    }
    return "Agent 1";
  });

  const [crmLoginPassword, setCrmLoginPassword] = useState("pass123");
  const [crmShowPassword, setCrmShowPassword] = useState(false);
  const [crmLoginError, setCrmLoginError] = useState("");

  const handleLogout = async () => {
    setUserMenuOpen(false);
    const agentToLogout = activeAgentId;
    if (typeof window !== "undefined") {
      try {
        sessionStorage.removeItem("crm_authenticated_session");
        sessionStorage.removeItem("ekms_active_agent");
        localStorage.removeItem("ekms_active_agent");
        sessionStorage.removeItem("crm_logged_in");
        localStorage.removeItem("crm_logged_in");
        sessionStorage.removeItem("ekms_agent_session");
        localStorage.removeItem("ekms_agent_session");
        window.dispatchEvent(new Event("storage"));
        window.dispatchEvent(new Event("ekms_auth_change"));
      } catch (_) {}
    }
    setCrmLoggedIn(false);
    if (agentToLogout) {
      try {
        const db = getFirestoreDb();
        if (db) {
          deleteDoc(doc(db, "sessions", agentToLogout)).catch(() => {});
        }
      } catch (_) {}
    }
    toast.info("Logged out from CRM");
  };

  const handleCrmLoginSubmit = (e) => {
    e?.preventDefault();
    setCrmLoginError("");

    const rawId = (crmLoginId || "").trim();
    if (!rawId) {
      setCrmLoginError("Please enter your Agent ID or Email.");
      return;
    }

    const clean = rawId.toLowerCase().replace(/\s+/g, "");
    let resolvedAgent = rawId;
    if (clean === "agent1" || clean.startsWith("agent1@")) resolvedAgent = "Agent 1";
    else if (clean === "agent2" || clean.startsWith("agent2@")) resolvedAgent = "Agent 2";
    else if (clean === "agent3" || clean.startsWith("agent3@")) resolvedAgent = "Agent 3";
    else if (clean === "admin1" || clean.startsWith("admin1@")) resolvedAgent = "Admin 1";
    else if (clean === "admin2" || clean.startsWith("admin2@")) resolvedAgent = "Admin 2";

    if (!crmLoginPassword) {
      setCrmLoginError("Password is required.");
      return;
    }

    if (crmLoginPassword !== "pass123" && crmLoginPassword.length < 3) {
      setCrmLoginError("Invalid password. Demo password is pass123");
      return;
    }

    setActiveAgentId(resolvedAgent);
    const sessionObj = {
      agentId: resolvedAgent,
      sessionId: "sess-" + Date.now().toString(36) + "-" + Math.random().toString(36).substring(2, 8),
      loggedInAt: Date.now(),
    };
    if (typeof window !== "undefined") {
      try {
        const jsonStr = JSON.stringify(sessionObj);
        sessionStorage.setItem("ekms_active_agent", jsonStr);
        localStorage.setItem("ekms_active_agent", jsonStr);
        sessionStorage.setItem("crm_authenticated_session", "true");
        sessionStorage.setItem("crm_logged_in", "true");
        localStorage.setItem("crm_logged_in", "true");
        window.dispatchEvent(new Event("storage"));
        window.dispatchEvent(new Event("ekms_auth_change"));
      } catch (_) {}
    }

    try {
      const db = getFirestoreDb();
      setDoc(doc(db, "sessions", resolvedAgent), {
        agentId: resolvedAgent,
        sessionId: sessionObj.sessionId,
        loggedInAt: Date.now(),
        lastHeartbeat: Date.now(),
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
      }).catch(() => {});
    } catch (_) {}

    setCrmLoggedIn(true);
    toast.success(`Logged in as ${resolvedAgent}`);
  };

  // Synchronize active agent across Main Page and CRM in real-time
  useEffect(() => {
    if (typeof window === "undefined") return;
    const syncActiveAgent = () => {
      try {
        const stored = sessionStorage.getItem("ekms_active_agent") || localStorage.getItem("ekms_active_agent");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed?.agentId && parsed?.sessionId) {
            const clean = parsed.agentId.trim().toLowerCase().replace(/\s+/g, "");
            let mapped = parsed.agentId;
            if (clean === "agent1") mapped = "Agent 1";
            else if (clean === "agent2") mapped = "Agent 2";
            else if (clean === "agent3") mapped = "Agent 3";
            else if (clean === "admin1") mapped = "Admin 1";
            else if (clean === "admin2") mapped = "Admin 2";
            setActiveAgentId(mapped);
            setCrmLoginId(mapped);
            if (sessionStorage.getItem("crm_authenticated_session") === "true") {
              setCrmLoggedIn(true);
            } else {
              setCrmLoggedIn(false);
            }
            return;
          }
        }
        if (sessionStorage.getItem("crm_authenticated_session") !== "true") {
          setCrmLoggedIn(false);
        }
      } catch (_) {}
    };

    syncActiveAgent();
    window.addEventListener("storage", syncActiveAgent);
    window.addEventListener("ekms_auth_change", syncActiveAgent);
    return () => {
      window.removeEventListener("storage", syncActiveAgent);
      window.removeEventListener("ekms_auth_change", syncActiveAgent);
    };
  }, []);

  // Beneficiary Form State - Blank by default, filled on call / manual entry
  const [beneficiaryData, setBeneficiaryData] = useState({
    beneficiaryId: initialBeneficiaryId || "",
    state: "Assam",
    center: "Asam Center 1",
    phoneNumber: "",
    branching: "Child",
    firstName: "",
    lastName: "",
    gender: "Male",
    district: "",
    pinCode: "",
    block: "",
    village: "",
    age: "",
    addressLine1: "",
    addressLine2: "",
    typeOfContact: "",
    registrationDate: "",
    ipNumber: "4300000000",
    employerName: "",
    parent: "",
  });

  useEffect(() => {
    setBeneficiaryData((prev) => {
      if (!prev.beneficiaryId) {
        return {
          ...prev,
          beneficiaryId: `261008-${Math.floor(10000 + Math.random() * 90000)}`,
          registrationDate: new Date().toLocaleDateString("en-GB") + " " + new Date().toLocaleTimeString("en-GB"),
        };
      }
      return prev;
    });
  }, []);
  const [formErrors, setFormErrors] = useState({});
  const [confirmDeleteModal, setConfirmDeleteModal] = useState({
    isOpen: false,
    type: "single", // "single" | "bulk"
    id: null,
    name: "",
    count: 0,
  });
  const [callHistory, setCallHistory] = useState([]);
  const [callHistoryExpanded, setCallHistoryExpanded] = useState(true);
  const [surveyHistory, setSurveyHistory] = useState([]);
  const [surveyModalOpen, setSurveyModalOpen] = useState(false);
  const [selectedSurvey, setSelectedSurvey] = useState(null);
  const [selectedSurveyRowId, setSelectedSurveyRowId] = useState(null);
  const [selectedCampaignId, setSelectedCampaignId] = useState(null);
  const [selectedCallHistoryId, setSelectedCallHistoryId] = useState(null);
  const [esicModalOpen, setEsicModalOpen] = useState(false);
  const [triageReportsVersion, setTriageReportsVersion] = useState(0);

  // Helper to detect any legacy default / mock forms
  const isMockSurveyRecord = useCallback((item) => {
    if (!item) return false;
    const c = String(item.campaign || "").trim().toLowerCase();
    const f = String(item.form || "").trim().toLowerCase();
    const d = String(item.submittedDate || "").trim();
    return (
      c.includes("test outbound") ||
      f.includes("test outbound") ||
      c.includes("not connected_preventive") ||
      f.includes("preventive health screening") ||
      d === "01-09-2026"
    );
  }, []);

  // Unified history loader: loads both calls and surveys across all persistent storage sources
  const loadBeneficiaryHistory = useCallback((targetBenId, phoneDigits = null) => {
    if (typeof window === "undefined") return { calls: [], surveys: [] };
    const curId = String(targetBenId || "").trim();
    let curPhone = (phoneDigits || "").toString().replace(/\D/g, "").slice(-10);

    // Auto-detect phone number if missing but curId is present
    if (!curPhone && curId) {
      try {
        const stored = JSON.parse(localStorage.getItem("crm_beneficiaries_registry") || "[]");
        const match = stored.find((b) => b && (String(b.id) === curId || String(b.beneficiaryId) === curId));
        if (match && (match.phoneNumber || match.phone)) {
          curPhone = String(match.phoneNumber || match.phone).replace(/\D/g, "").slice(-10);
        }
      } catch (_) {}
      if (!curPhone) {
        try {
          const reports = JSON.parse(localStorage.getItem("crm_inbound_triage_reports") || "[]");
          const match = reports.find((r) => r && (String(r.beneficiaryId) === curId || String(r.id) === curId));
          if (match && (match.details?.phone || match.phone)) {
            curPhone = String(match.details?.phone || match.phone).replace(/\D/g, "").slice(-10);
          }
        } catch (_) {}
      }
      if (!curPhone) {
        try {
          const calls = JSON.parse(localStorage.getItem("crm_all_call_logs") || "[]");
          const match = calls.find((c) => c && (String(c.beneficiaryId) === curId || String(c.id) === curId));
          if (match && (match.cleanPhone || match.phoneNumber)) {
            curPhone = String(match.cleanPhone || match.phoneNumber).replace(/\D/g, "").slice(-10);
          }
        } catch (_) {}
      }
    }

    if (!curId && !curPhone) return { calls: [], surveys: [] };

    const deletedReportIds = (() => {
      try {
        const d = JSON.parse(localStorage.getItem("crm_deleted_report_ids") || "[]");
        return Array.isArray(d) ? d.map(String) : [];
      } catch (_) { return []; }
    })();

    const deletedCallIds = (() => {
      try {
        const d = JSON.parse(localStorage.getItem("crm_deleted_call_ids") || "[]");
        return Array.isArray(d) ? new Set(d.map(String)) : new Set();
      } catch (_) { return new Set(); }
    })();

    // Helper to verify a call record has not been deleted/tombstoned
    const isCallActive = (c) => {
      if (!c || !c.id) return false;
      const idStr = String(c.id);
      const caseIdStr = c.caseId ? String(c.caseId) : "";
      if (deletedCallIds.has(idStr)) return false;
      if (caseIdStr && deletedCallIds.has(caseIdStr)) return false;
      if (idStr.startsWith("call_triage_")) {
        const rawTriageId = idStr.replace("call_triage_", "");
        if (deletedCallIds.has(rawTriageId) || deletedReportIds.includes(rawTriageId)) return false;
      }
      return true;
    };

    // --- 1. CALLS ---
    const callMap = new Map();

    // A. From crm_call_history_${curId}
    if (curId) {
      try {
        const raw = localStorage.getItem(`crm_call_history_${curId}`);
        if (raw) {
          const list = JSON.parse(raw);
          if (Array.isArray(list)) {
            list.forEach((c) => {
              if (c && c.id && isCallActive(c)) callMap.set(String(c.id), c);
            });
          }
        }
      } catch (_) {}
    }

    // B. From crm_call_history_phone_${curPhone}
    if (curPhone) {
      try {
        const raw = localStorage.getItem(`crm_call_history_phone_${curPhone}`);
        if (raw) {
          const list = JSON.parse(raw);
          if (Array.isArray(list)) {
            list.forEach((c) => {
              if (c && c.id && isCallActive(c)) callMap.set(String(c.id), c);
            });
          }
        }
      } catch (_) {}
    }

    // C. From crm_all_call_logs
    try {
      const rawAll = localStorage.getItem("crm_all_call_logs");
      if (rawAll) {
        const listAll = JSON.parse(rawAll);
        if (Array.isArray(listAll)) {
          listAll.forEach((c) => {
            if (!c || !c.id || !isCallActive(c)) return;
            const cBen = String(c.beneficiaryId || "").trim();
            const cPh = (c.cleanPhone || c.phoneNumber || "").toString().replace(/\D/g, "").slice(-10);
            if ((curId && cBen === curId) || (curPhone && cPh === curPhone)) {
              if (!callMap.has(String(c.id))) {
                callMap.set(String(c.id), { ...c, beneficiaryId: c.beneficiaryId || curId });
              }
            }
          });
        }
      }
    } catch (_) {}

    // D. From crm_inbound_triage_reports (synthesize call record if no explicit call log exists)
    try {
      const rawReports = localStorage.getItem("crm_inbound_triage_reports");
      if (rawReports) {
        const reportsList = JSON.parse(rawReports);
        if (Array.isArray(reportsList)) {
          reportsList.forEach((r) => {
            if (!r || !r.id) return;
            const rIdStr = String(r.id);
            const rCaseIdStr = r.caseId ? String(r.caseId) : "";
            const callKey = `call_triage_${r.id}`;
            if (
              deletedReportIds.includes(rIdStr) ||
              (rCaseIdStr && deletedReportIds.includes(rCaseIdStr)) ||
              deletedCallIds.has(rIdStr) ||
              deletedCallIds.has(callKey) ||
              (rCaseIdStr && deletedCallIds.has(rCaseIdStr))
            ) {
              return;
            }
            const rBen = String(r.beneficiaryId || "").trim();
            const rPh = (r.details?.phone || r.phone || r.cleanPhone || "").toString().replace(/\D/g, "").slice(-10);
            if ((curId && rBen === curId) || (curPhone && rPh === curPhone)) {
              const hasExisting = Array.from(callMap.values()).some(
                (c) => (r.caseId && c.caseId === r.caseId) || String(c.id) === String(r.id) || String(c.id) === callKey
              );
              if (!hasExisting) {
                const complaint = (r.details?.responses?.find((q) => q.q === "Summary" || q.q === "Chief Complaint")?.a) || "Inbound triage consultation completed";
                callMap.set(callKey, {
                  id: callKey,
                  beneficiaryId: curId || rBen,
                  caseId: r.caseId || "",
                  fullName: r.name || "Beneficiary",
                  phoneNumber: curPhone ? `+91-${curPhone}` : "+91-6002283107",
                  cleanPhone: curPhone,
                  type: "Inbound Call",
                  callType: "",
                  campaign: r.campaign || "Inbound Triage",
                  date: r.submittedDate || new Date(r.createdAt || Date.now()).toLocaleDateString("en-GB").replace(/\//g, "-"),
                  time: r.timeAndDate ? r.timeAndDate.split(" ").slice(-2).join(" ") : "12:00 PM",
                  timestamp: r.timeAndDate || `${r.submittedDate || "10-10-2026"} 12:00 PM`,
                  createdAt: r.createdAt || Date.now(),
                  status: "Connected",
                  duration: "02:30",
                  callConnected: true,
                  agent: r.agent || "Agent 1",
                  notes: complaint,
                });
              }
            }
          });
        }
      }
    } catch (_) {}

    const calls = filterOnlyCalls(Array.from(callMap.values())).sort((a, b) => {
      const ta = new Date(a.createdAt || a.timestamp || a.date || 0).getTime();
      const tb = new Date(b.createdAt || b.timestamp || b.date || 0).getTime();
      return tb - ta;
    });

    // --- 2. SURVEYS ---
    const surveyMap = new Map();

    // A. From crm_surveys_ben_${curId}
    if (curId) {
      try {
        const raw = localStorage.getItem(`crm_surveys_ben_${curId}`);
        if (raw) {
          const list = JSON.parse(raw);
          if (Array.isArray(list)) {
            list.forEach((s) => {
              if (s && s.id && !isMockSurveyRecord(s)) {
                surveyMap.set(String(s.id), s);
              }
            });
          }
        }
      } catch (_) {}
    }

    // B. From crm_surveys_ben_${curPhone}
    if (curPhone) {
      try {
        const raw = localStorage.getItem(`crm_surveys_ben_${curPhone}`);
        if (raw) {
          const list = JSON.parse(raw);
          if (Array.isArray(list)) {
            list.forEach((s) => {
              if (s && s.id && !isMockSurveyRecord(s)) {
                surveyMap.set(String(s.id), s);
              }
            });
          }
        }
      } catch (_) {}
    }

    // C. From crm_inbound_triage_reports
    try {
      const rawReports = localStorage.getItem("crm_inbound_triage_reports");
      if (rawReports) {
        const reportsList = JSON.parse(rawReports);
        if (Array.isArray(reportsList)) {
          reportsList.forEach((r) => {
            if (!r || !r.id || isMockSurveyRecord(r)) return;
            const rIdStr = String(r.id);
            const rCaseIdStr = r.caseId ? String(r.caseId) : "";
            if (deletedReportIds.includes(rIdStr) || (rCaseIdStr && deletedReportIds.includes(rCaseIdStr))) {
              return;
            }
            const rBen = String(r.beneficiaryId || "").trim();
            const rPh = (r.details?.phone || r.phone || r.cleanPhone || "").toString().replace(/\D/g, "").slice(-10);
            if ((curId && rBen === curId) || (curPhone && rPh === curPhone)) {
              if (!surveyMap.has(String(r.id))) {
                const urgency = (r.details?.responses?.find((q) => q.q === "Triage Urgency Level")?.a) || "";
                surveyMap.set(String(r.id), {
                  id: r.id,
                  createdAt: r.createdAt || Date.now(),
                  campaign: r.campaign || "Inbound Triage",
                  form: r.form || "Inbound Triage Form",
                  followup: (urgency === "Severe" || urgency === "Moderate" || urgency === "Emergency" || urgency === "Urgent") ? "Yes" : "No",
                  submittedDate: r.submittedDate || "10-10-2026",
                  agent: r.agent || "Agent 1",
                  timeAndDate: r.timeAndDate || `${r.submittedDate || "10-10-2026"} 12:00 PM`,
                  details: r.details,
                });
              }
            }
          });
        }
      }
    } catch (_) {}

    // C. From crm_beneficiaries_registry
    try {
      const reg = JSON.parse(localStorage.getItem("crm_beneficiaries_registry") || "[]");
      if (Array.isArray(reg)) {
        const b = reg.find((x) => x && (String(x.id) === curId || String(x.beneficiaryId) === curId));
        if (b && Array.isArray(b.surveys)) {
          b.surveys.forEach((s) => {
            if (s && s.id && !isMockSurveyRecord(s) && !surveyMap.has(String(s.id))) {
              surveyMap.set(String(s.id), s);
            }
          });
        }
      }
    } catch (_) {}

    const surveys = Array.from(surveyMap.values()).sort((a, b) => {
      const ta = new Date(a.createdAt || a.timeAndDate || a.submittedDate || 0).getTime();
      const tb = new Date(b.createdAt || b.timeAndDate || b.submittedDate || 0).getTime();
      return tb - ta;
    });

    return { calls, surveys };
  }, [isMockSurveyRecord]);

  // Sync / load call history & survey history for the active beneficiary profile
  useEffect(() => {
    const benId = beneficiaryData.beneficiaryId;
    if (!benId) {
      setCallHistory([]);
      setSurveyHistory([]);
      return;
    }

    // 1. Instant synchronous load across all local storage sources (0ms, 0 Firestore reads)
    const { calls: localCalls, surveys: localSurveys } = loadBeneficiaryHistory(benId, beneficiaryData.phoneNumber);
    if (localCalls && localCalls.length > 0) {
      setCallHistory(localCalls);
    }
    if (localSurveys && localSurveys.length > 0) {
      setSurveyHistory(localSurveys);
    }

    // 2. Fetch remote Firestore calls in the background and merge without overwriting
    const fetchRemoteHistory = async () => {
      try {
        const crmDb = getCrmFirestoreDb();
        if (!crmDb) return;
        const historyRef = collection(crmDb, "crm_call_history");
        const q = query(historyRef, where("beneficiaryId", "==", benId));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const remoteList = [];
          snap.forEach((d) => remoteList.push({ id: d.id, ...d.data() }));
          const filtered = filterOnlyCalls(remoteList).filter(
            (item) => !item.beneficiaryId || String(item.beneficiaryId) === String(benId)
          );
          setCallHistory((prev) => {
            const map = new Map();
            filtered.forEach((c) => map.set(String(c.id), c));
            (prev || []).forEach((c) => map.set(String(c.id), c));
            const merged = Array.from(map.values()).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
            setCachedCrmCallHistory(benId, merged);
            return merged;
          });
        }
      } catch (err) {
        console.warn("CRM DB call history fetch warning:", err);
      }
    };
    fetchRemoteHistory();
  }, [beneficiaryData.beneficiaryId, beneficiaryData.phoneNumber, loadBeneficiaryHistory]);

  // Real-time cross-tab synchronization for call history & triage reports (0 Firestore reads)
  useEffect(() => {
    const unsub = subscribeToSync((msg) => {
      if (msg?.type === "CRM_CALL_HISTORY_UPDATED") {
        const { benId, history } = msg.payload || {};
        const curBenId = beneficiaryData.beneficiaryId;
        if (benId && curBenId && String(benId) === String(curBenId)) {
          const strictlyThisBen = (history || []).filter(
            (h) => !h.beneficiaryId || String(h.beneficiaryId) === String(curBenId)
          );
          setCallHistory(filterOnlyCalls(strictlyThisBen));
        }
      } else if (msg?.type === "CRM_TRIAGE_REPORT_DELETED" || msg?.type === "CRM_TRIAGE_REPORT_SAVED") {
        setTriageReportsVersion((v) => v + 1);
      }
    });

    const handleStorage = (e) => {
      if (
        e.key === "crm_deleted_report_ids" ||
        e.key === "crm_inbound_triage_reports" ||
        (e.key && e.key.startsWith("crm_surveys_ben_")) ||
        (e.key && e.key.startsWith("crm_call_history_")) ||
        e.key === "crm_all_call_logs"
      ) {
        setTriageReportsVersion((v) => v + 1);
        if (beneficiaryData.beneficiaryId) {
          const { calls, surveys } = loadBeneficiaryHistory(beneficiaryData.beneficiaryId, beneficiaryData.phoneNumber);
          if (calls.length > 0) setCallHistory(calls);
          if (surveys.length > 0) setSurveyHistory(surveys);
        }
      }
    };
    window.addEventListener("storage", handleStorage);

    return () => {
      unsub();
      window.removeEventListener("storage", handleStorage);
    };
  }, [beneficiaryData.beneficiaryId, beneficiaryData.phoneNumber, loadBeneficiaryHistory]);

  // CZ-Bar Call & Connection States (accessible across all handlers and forms)
  const [czPhoneNumber, setCzPhoneNumber] = useState("");
  const [czFreeSeconds, setCzFreeSeconds] = useState(427); // Starts at 00:07:07 as in media_1791448189089.png
  const [czCallActive, setCzCallActive] = useState(false);
  const [czDndActive, setCzDndActive] = useState(false);
  const [czBreakActive, setCzBreakActive] = useState(false);
  // Mode: "inbound" (default "Waiting for Call" as in media_1791451576722.png) or "outbound"
  const [czCallMode, setCzCallMode] = useState("inbound");
  const [incomingCall, setIncomingCall] = useState(null);
  const [activeCallData, setActiveCallData] = useState(null);
  const [czCallDuration, setCzCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isOnHold, setIsOnHold] = useState(false);

  const lastConnectedCallRef = useRef(null);
  const czCallModeRef = useRef(czCallMode);
  const incomingCallRef = useRef(incomingCall);
  const activeCallRef = useRef(activeCallData);
  const callChannelRef = useRef(null);
  const audioChannelRef = useRef(null);
  const currentCallFormSavedRef = useRef(false);
  const currentCallBenIdRef = useRef(null);

  // Inbound Triage Form State (Full screen modal with Triage AI chat on left & Outcomes on right)
  const [inboundTriageModalOpen, setInboundTriageModalOpen] = useState(false);
  const [triageLoading, setTriageLoading] = useState(false);
  const [triageOutcome, setTriageOutcome] = useState(() => {
    if (typeof window === "undefined") return null;
    try {
      const benId = initialBeneficiaryId || "session";
      const raw = sessionStorage.getItem(`crm_triage_outcome_${benId}`) || localStorage.getItem(`crm_triage_outcome_${benId}`);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && parsed.cachedAt) {
        if (Date.now() - parsed.cachedAt <= 3 * 60 * 1000) {
          return parsed.data;
        }
        return null;
      }
      return parsed;
    } catch (_) {
      return null;
    }
  });
  const [triageActiveDirective, setTriageActiveDirective] = useState(null);
  const [triageNotes, setTriageNotes] = useState("");
  const [ekmsContext, setEkmsContext] = useState(null);
  const [activeTriageCaseRef, setActiveTriageCaseRef] = useState(null);
  const triageChatRef = useRef(null);
  const crmChatExpiryTimers = useRef({});

  // Derived visible call history (strictly ONLY actual connected calls for THIS active beneficiary)
  const visibleCallHistory = useMemo(() => {
    const curBenId = String(beneficiaryData.beneficiaryId || beneficiaryData.id || "").trim();
    const curPhone = (beneficiaryData.phoneNumber || "").replace(/\D/g, "").slice(-10);

    const deletedCallIds = (() => {
      try {
        const d = JSON.parse(localStorage.getItem("crm_deleted_call_ids") || "[]");
        return Array.isArray(d) ? new Set(d.map(String)) : new Set();
      } catch (_) { return new Set(); }
    })();

    const deletedReportIds = (() => {
      try {
        const d = JSON.parse(localStorage.getItem("crm_deleted_report_ids") || "[]");
        return Array.isArray(d) ? new Set(d.map(String)) : new Set();
      } catch (_) { return new Set(); }
    })();

    return (callHistory || []).filter((item) => {
      if (!item) return false;

      // Filter out deleted calls / reports
      const itemIdStr = String(item.id || "");
      const itemCaseIdStr = item.caseId ? String(item.caseId) : "";
      if (deletedCallIds.has(itemIdStr)) return false;
      if (itemCaseIdStr && deletedCallIds.has(itemCaseIdStr)) return false;
      if (itemIdStr.startsWith("call_triage_")) {
        const rawId = itemIdStr.replace("call_triage_", "");
        if (deletedCallIds.has(rawId) || deletedReportIds.has(rawId)) return false;
      }

      // STRICT ISOLATION: Must belong strictly to the current beneficiary
      const iBenId = String(item.beneficiaryId || "").trim();
      const iPhone = (item.cleanPhone || item.phoneNumber || "").toString().replace(/\D/g, "").slice(-10);
      if (curBenId || curPhone) {
        const matchesBen = curBenId && iBenId && curBenId === iBenId;
        const matchesPhone = curPhone && iPhone && curPhone === iPhone;
        if (!matchesBen && !matchesPhone) return false;
      }

      const st = String(item.status || "").toLowerCase();
      const dur = String(item.duration || "").trim();
      const notes = String(item.notes || "").toLowerCase();

      // Only filter out fake 00:00 placeholders from blank form opening
      if ((dur === "00:00" || dur === "0" || !dur) && (notes.includes("form opened") || notes.includes("beneficiary form opened"))) {
        return false;
      }

      if (st.includes("not connected") || notes.includes("no call connected") || st.includes("missed") || item.callConnected === false) {
        if (!item.caseId && !String(item.campaign || "").toLowerCase().includes("triage")) {
          return false;
        }
      }

      // Hide present triage case while that triage is in progress
      if (inboundTriageModalOpen) {
        const activeRef = activeTriageCaseRef || triageOutcome?.case_ref || triageOutcome?.case_id;
        const itemCaseId = item.caseId ? String(item.caseId) : "";
        const itemId = item.id ? String(item.id) : "";
        if (activeRef && (itemCaseId === String(activeRef) || itemId === String(activeRef))) {
          return false;
        }
      }

      return true;
    });
  }, [callHistory, beneficiaryData.beneficiaryId, beneficiaryData.phoneNumber, beneficiaryData.id, inboundTriageModalOpen, activeTriageCaseRef, triageOutcome, triageReportsVersion]);

  // crmOnlyCallHistory is defined below loadAllTriageReports


  const handleOpenInboundTriageModal = () => {
    const benId = beneficiaryData.beneficiaryId || "session";
    const chatKey = `crm_triage_chat_${benId}`;
    const outcomeKey = `crm_triage_outcome_${benId}`;

    // Cancel pending 3-minute background cleanup timer if reopened within 3 minutes
    if (crmChatExpiryTimers.current[chatKey]) {
      clearTimeout(crmChatExpiryTimers.current[chatKey]);
      delete crmChatExpiryTimers.current[chatKey];
    }

    // Check if there is an in-progress session left in local storage within the last 3 minutes (180,000 ms)
    const cachedChat = getCachedAiChatSession(chatKey);
    let cachedOutcome = null;
    try {
      const rawOutcome = sessionStorage.getItem(outcomeKey) || localStorage.getItem(outcomeKey);
      if (rawOutcome) {
        const parsed = JSON.parse(rawOutcome);
        if (parsed && typeof parsed === "object" && parsed.cachedAt) {
          if (Date.now() - parsed.cachedAt <= 3 * 60 * 1000) {
            cachedOutcome = parsed.data;
          } else {
            sessionStorage.removeItem(outcomeKey);
            localStorage.removeItem(outcomeKey);
          }
        } else if (parsed && typeof parsed === "object" && !parsed.cachedAt) {
          cachedOutcome = parsed;
        }
      }
    } catch (_) {}

    const hasRecentSession = Boolean(
      (cachedChat && Array.isArray(cachedChat.messages) && cachedChat.messages.length > 0) ||
      cachedOutcome
    );

    if (hasRecentSession) {
      // Reopened within 3 minutes: retain the in-progress chat and outcome without touching database
      if (cachedOutcome) {
        setTriageOutcome(cachedOutcome);
        if (cachedOutcome.case_ref) {
          setActiveTriageCaseRef(cachedOutcome.case_ref);
        }
      }
    } else {
      // After 3 minutes or completely new consultation: open fresh new consultation
      clearCachedAiChatSession(chatKey);
      try {
        sessionStorage.removeItem(outcomeKey);
        localStorage.removeItem(outcomeKey);
      } catch (_) {}
      setTriageNotes("");
      setEkmsContext(null);
      setTriageOutcome(null);
      triageChatRef.current?.resetChat?.();

      const existingCases = typeof getCachedCases === "function" ? (getCachedCases() || []) : [];
      const freshCaseId = generateNextCaseRef(existingCases, beneficiaryData.phoneNumber);
      setActiveTriageCaseRef(freshCaseId);
    }

    setInboundTriageModalOpen(true);
  };

  const handleCloseInboundTriageModal = () => {
    const benId = beneficiaryData.beneficiaryId || "session";
    const chatKey = `crm_triage_chat_${benId}`;
    const outcomeKey = `crm_triage_outcome_${benId}`;

    // Leaving chat in between: chat stays in local storage for exactly 3 minutes without saving to DB.
    // Set 3-minute background timer to purge when idle > 3 min
    if (crmChatExpiryTimers.current[chatKey]) {
      clearTimeout(crmChatExpiryTimers.current[chatKey]);
    }
    crmChatExpiryTimers.current[chatKey] = setTimeout(() => {
      try {
        clearCachedAiChatSession(chatKey);
        sessionStorage.removeItem(outcomeKey);
        localStorage.removeItem(outcomeKey);
      } catch (_) {}
      delete crmChatExpiryTimers.current[chatKey];
    }, 3 * 60 * 1000); // 3 minutes TTL

    setInboundTriageModalOpen(false);
  };

  const handleResetInboundChat = () => {
    const benId = beneficiaryData.beneficiaryId || "session";
    const chatKey = `crm_triage_chat_${benId}`;
    const outcomeKey = `crm_triage_outcome_${benId}`;

    if (crmChatExpiryTimers.current[chatKey]) {
      clearTimeout(crmChatExpiryTimers.current[chatKey]);
      delete crmChatExpiryTimers.current[chatKey];
    }

    try {
      clearCachedAiChatSession(chatKey);
      sessionStorage.removeItem(chatKey);
      localStorage.removeItem(chatKey);
      sessionStorage.removeItem(outcomeKey);
      localStorage.removeItem(outcomeKey);
    } catch (_) {}

    triageChatRef.current?.resetChat?.();
    setTriageNotes("");
    setEkmsContext(null);
    setTriageOutcome(null);

    const freshCaseId = generateNextCaseRef();
    setActiveTriageCaseRef(freshCaseId);

    toast.success("Triage chat reset successfully.");
  };

  const triageCallerIntake = useMemo(() => {
    const rawPhone = beneficiaryData.phoneNumber || "6002283107";
    const cleanPhone = rawPhone.replace(/\D/g, "").slice(-10);
    return {
      caller_name: `${beneficiaryData.firstName || ""} ${beneficiaryData.lastName || ""}`.trim() || "Beneficiary",
      phone: cleanPhone || "6002283107",
      age: beneficiaryData.age ? Number(beneficiaryData.age) : 33,
      sex: beneficiaryData.gender || "Male",
      district: beneficiaryData.district ? String(beneficiaryData.district).trim() : "",
      pincode: beneficiaryData.pinCode ? String(beneficiaryData.pinCode).trim() : "",
      city: beneficiaryData.village || beneficiaryData.block || beneficiaryData.addressLine1 || "",
      symptom_notes: triageNotes,
    };
  }, [beneficiaryData, triageNotes]);

  const saveTriageRecordAutomatically = (outcome) => {
    if (!outcome) return;
    try {
      const benFullName = `${beneficiaryData.firstName || ""} ${beneficiaryData.lastName || ""}`.trim();
      if (!beneficiaryData.firstName?.trim() || !benFullName || benFullName.toLowerCase() === "beneficiary" || benFullName.toLowerCase() === "name") {
        console.warn("Beneficiary Name is mandatory to save form. Cannot save triage record.");
        return;
      }

      const now = new Date();
    const dateStr = now.toLocaleDateString("en-GB").replace(/\//g, "-");
    const timeStr = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
    const fullDateTime = `${dateStr} ${timeStr}`;

    const urgency = normalizeUrgency(outcome.triage?.urgency_level) || "Moderate";
    const notesSummary = outcome.triage?.summary_en || outcome.triage?.recommended_action || "Inbound triage consultation completed";
    const recFacility = outcome.triage?.recommended_facility_type || outcome.triage?.referral_destination || "104 Health Helpline (Doctor on Call)";

    // 1. Case ID in canonical format (e.g. CA0181AB01) matching main page format
    let caseId = outcome.case_ref || outcome.case_id || "";
    const existingReports = typeof window !== "undefined" ? JSON.parse(localStorage.getItem("crm_inbound_triage_reports") || "[]") : [];
    const isAlreadyUsed = existingReports.some((r) => r.caseId === caseId);
    if (!caseId || !caseId.startsWith("CA") || isAlreadyUsed) {
      caseId = generateNextCaseRef();
    }

    // 2. Complaint same as from the main web page case logs
    const complaint = outcome.triage?.summary_en || outcome.clinical_summary || notesSummary || "";

    // 3. Chief Complaint (same as main page chief complaints)
    let chiefComplaint = "";
    try {
      const problems = extractCallerReportedProblems({
        result: outcome,
        callerIntake: {
          symptom_notes: notesSummary,
          phone: beneficiaryData.phoneNumber,
          caller_name: `${beneficiaryData.firstName || ""} ${beneficiaryData.lastName || ""}`.trim(),
        },
        t: outcome.triage,
      });
      if (Array.isArray(problems) && problems.length > 0) {
        chiefComplaint = problems.join(", ");
      }
    } catch (_) {}
    if (!chiefComplaint) {
      chiefComplaint = outcome.triage?.primary_complaint || outcome.ekms_ai_context?.triageState?.condition || outcome.triage?.chief_complaint || "";
    }

    // 4. Clinical Red Flags
    const rawFlags = [];
    if (Array.isArray(outcome.triage?.red_flags)) rawFlags.push(...outcome.triage.red_flags);
    if (Array.isArray(outcome.ekms_ai_context?.triageState?.redFlagsDetected)) {
      rawFlags.push(...outcome.ekms_ai_context.triageState.redFlagsDetected);
    }
    const redFlagsText = rawFlags.length > 0
      ? [...new Set(rawFlags)].join(", ")
      : "None reported (No acute hemodynamic danger signs)";

    // 5. History of Present Illness(from how long it happening)
    let hpiDuration = outcome.ekms_ai_context?.triageState?.duration || outcome.ekms_ai_context?.duration || "";
    if (!hpiDuration) {
      const allText = `${notesSummary} ${triageNotes}`.toLowerCase();
      const durMatch = allText.match(/\b(since\s+[\w\s]+|\d+\s*(?:days?|hours?|weeks?|months?|dino?|ghante?)|aaj\s*se|kal\s*se|today|yesterday|morning|subah\s*se|raat\s*se)\b/i);
      hpiDuration = durMatch ? durMatch[0] : "";
    }

    // 6. Associated Symptoms:
    let associatedSymptoms = "";
    const ctxAssoc = outcome.ekms_ai_context?.triageState?.associated;
    if (Array.isArray(ctxAssoc) && ctxAssoc.length > 0) {
      associatedSymptoms = ctxAssoc.slice(0, 2).join(", ");
    } else if (typeof ctxAssoc === "string") {
      associatedSymptoms = ctxAssoc;
    }

    // 7. Comorbidity
    let comorbidity =
      outcome.ekms_ai_context?.triageState?.comorbidity ||
      outcome.ekms_ai_context?.triageState?.comorbidities ||
      outcome.triage?.comorbidity ||
      "";
    if (/^(none|nil|no pre|none reported)/i.test(comorbidity.trim())) {
      comorbidity = "";
    }

    // 8. Any medication
    let medication =
      outcome.ekms_ai_context?.triageState?.medications ||
      outcome.ekms_ai_context?.triageState?.medication ||
      outcome.triage?.medication ||
      "";
    if (/^(none|nil|no meds|no medication)/i.test(medication.trim())) {
      medication = "";
    }

    // 9. Booking (facility name and booking date)
    const bookingFacility = outcome.booked_appointment?.facilityName || "";
    const bookingDate = outcome.booked_appointment?.date || "";
    const bookingSlot = outcome.booked_appointment?.timeSlot || "";
    let bookingFormatted = "";
    if (bookingFacility || bookingDate) {
      bookingFormatted = `${bookingFacility}${bookingDate ? ` - ${bookingDate}` : ""}${bookingSlot ? ` (${bookingSlot})` : ""}`.trim().replace(/^-\s*/, "");
    } else if (outcome.booking) {
      bookingFormatted = outcome.booking;
    }

    // 10. Reference No (if generated, else keep blank)
    const referenceNo =
      outcome.dispatch_id ||
      outcome.reference_no ||
      outcome.booked_appointment?.referenceNo ||
      outcome.booked_appointment?.tokenNo ||
      "";

    // 11. Primary Referral by AI
    let primaryReferralByAi =
      outcome.triage?.call_referral_primary ||
      outcome.triage?.referral_destination ||
      outcome.triage?.recommended_facility_type ||
      "104 Health Helpline";
    if (primaryReferralByAi.toLowerCase().includes("104")) {
      primaryReferralByAi = "104 Health Helpline";
    }

    // 12. Recommended Facility by Agent
    // If the AI recommended facility is not changed by the agent, then Recommended Facility by Agent will be blank ("")
    let agentSelectedFacility = "";

    // Candidate facility explicitly chosen/forwarded to by agent
    let candidateAgentFacility = "";
    if (outcome.forwarded_facility_name) {
      candidateAgentFacility = outcome.forwarded_facility_name;
    } else if (outcome.forwarded_to && !outcome.forwarded_to.startsWith("DIR_")) {
      candidateAgentFacility = outcome.forwarded_to;
    } else if (outcome.booked_appointment?.facilityName) {
      candidateAgentFacility = outcome.booked_appointment.facilityName;
    } else if (outcome.target_facility?.name) {
      candidateAgentFacility = outcome.target_facility.name;
    }

    if (candidateAgentFacility) {
      const cleanCand = candidateAgentFacility.toLowerCase().replace(/[^a-z0-9]/g, "");
      const cleanAi = primaryReferralByAi.toLowerCase().replace(/[^a-z0-9]/g, "");
      const isSameAsAi =
        cleanCand === cleanAi ||
        (cleanCand.includes("104") && cleanAi.includes("104")) ||
        (cleanCand.includes("108") && cleanAi.includes("108")) ||
        (cleanCand.includes("beltola") && cleanAi.includes("beltola"));

      if (!isSameAsAi && !candidateAgentFacility.toUpperCase().includes("REFER TO DISTRICT HOSPITAL / PUBLIC HEALTHCARE")) {
        agentSelectedFacility = candidateAgentFacility;
      }
    }

    const hasLiveCall = Boolean(czCallActive || activeCallData || (czCallDuration && czCallDuration > 0));
    const hasRecentCompletedCall = Boolean(
      lastConnectedCallRef.current?.connected &&
      (!lastConnectedCallRef.current?.endedAt || Date.now() - lastConnectedCallRef.current.endedAt < 30 * 60 * 1000)
    );
    const isCallConn = hasLiveCall || hasRecentCompletedCall;
    const effectiveDurationSec = czCallDuration > 0
      ? czCallDuration
      : (lastConnectedCallRef.current?.duration || 0);

    // Save to Call History ONLY if call was actually connected!
    if (isCallConn) {
      const callDurationStr = `${String(Math.floor(effectiveDurationSec / 60)).padStart(2, "0")}:${String(effectiveDurationSec % 60).padStart(2, "0")}`;
      const triageCallLog = {
        id: `call_triage_${Date.now()}`,
        beneficiaryId: beneficiaryData.beneficiaryId,
        caseId: caseId,
        fullName: `${beneficiaryData.firstName || ""} ${beneficiaryData.lastName || ""}`.trim() || "Beneficiary",
        phoneNumber: beneficiaryData.phoneNumber ? `+91-${beneficiaryData.phoneNumber.replace(/\D/g, "").slice(-10)}` : "+91-7891236547",
        cleanPhone: (beneficiaryData.phoneNumber || "").replace(/\D/g, "").slice(-10),
        type: "Inbound Call",
        callType: "",
        category: "",
        subCategory: "",
        campaign: "Inbound Triage",
        date: dateStr,
        time: timeStr,
        timestamp: fullDateTime,
        createdAt: now.toISOString(),
        status: "Connected",
        duration: callDurationStr,
        callConnected: true,
        agent: activeAgentId || "Agent 1",
        notes: "Inbound call connected, Inbound Triage Form filled",
      };

      appendCrmCallLog(triageCallLog);
      const callNowTs = Date.now();
      if (beneficiaryData.beneficiaryId) {
        localStorage.setItem(`crm_ben_last_call_${beneficiaryData.beneficiaryId}`, String(callNowTs));
      }
      if (triageCallLog.cleanPhone) {
        localStorage.setItem(`crm_phone_last_call_${triageCallLog.cleanPhone}`, String(callNowTs));
      }
      setBeneficiaries((prev) => {
        const next = prev.map((b) => {
          const bPh = (b.phoneNumber || "").replace(/\D/g, "").slice(-10);
          if ((beneficiaryData.beneficiaryId && (b.id === beneficiaryData.beneficiaryId || b.beneficiaryId === beneficiaryData.beneficiaryId)) || (triageCallLog.cleanPhone && bPh === triageCallLog.cleanPhone)) {
            return { ...b, lastCallTimestamp: callNowTs, lastCallTime: fullDateTime };
          }
          return b;
        });
        next.sort((a, b) => (b.lastCallTimestamp || 0) - (a.lastCallTimestamp || 0));
        setCachedCrmBeneficiaries(next);
        return [...next];
      });

      setCallHistory((prev) => {
        const forThisBen = prev.filter(
          (h) => !h.beneficiaryId || String(h.beneficiaryId) === String(beneficiaryData.beneficiaryId)
        );
        const next = [triageCallLog, ...forThisBen.filter((h) => h.id !== triageCallLog.id)];
        if (beneficiaryData.beneficiaryId) {
          setCachedCrmCallHistory(beneficiaryData.beneficiaryId, next);
        }
        broadcastEvent("CRM_CALL_HISTORY_UPDATED", {
          benId: beneficiaryData.beneficiaryId,
          history: next,
        });
        return next;
      });
      currentCallFormSavedRef.current = true;
      setCallHistoryExpanded(true);

      try {
        const crmDb = getCrmFirestoreDb();
        if (crmDb) {
          setDoc(doc(crmDb, "crm_call_history", triageCallLog.id), triageCallLog).catch(() => {});
        }
      } catch (_) {}
    }

    // Also prepend to Survey / Form History table (newest on top)
    const triageSurveyEntry = {
      id: Date.now(),
      createdAt: Date.now(),
      campaign: "Inbound Triage",
      form: "Inbound Triage Form",
      followup: (urgency === "Severe" || urgency === "Moderate" || urgency === "Emergency" || urgency === "Urgent") ? "Yes" : "No",
      submittedDate: dateStr,
      details: {
        campaign: "Inbound Triage",
        callType: "",
        category: "",
        subCategory: "",
        booking: bookingFormatted,
        referenceNo: referenceNo,
        agentFacility: agentSelectedFacility,
        responses: [
          { q: "Case ID", a: caseId },
          { q: "Triage Urgency Level", a: urgency },
          { q: "Urgency Category", a: urgency },
          { q: "Summary", a: complaint },
          { q: "Chief Complaint", a: chiefComplaint },
          { q: "Clinical Red Flags", a: redFlagsText },
          { q: "History of Present Illness(from how long it happening)", a: hpiDuration },
          { q: "Associated Symptoms:", a: associatedSymptoms },
          { q: "Comorbidity", a: comorbidity },
          { q: "Any medication", a: medication },
          { q: "Primary Referral by AI", a: primaryReferralByAi },
          { q: "Recommended Facility by Agent", a: agentSelectedFacility },
          { q: "Booking", a: bookingFormatted },
          { q: "Reference No", a: referenceNo },
          { q: "Attending Agent", a: activeAgentId || "Agent 1" },
        ],
      },
    };

    setSurveyHistory((prev) => {
      const next = [triageSurveyEntry, ...prev];
      try {
        localStorage.setItem(`crm_surveys_ben_${beneficiaryData.beneficiaryId}`, JSON.stringify(next));
      } catch (_) {}
      return next;
    });

    try {
      const globalReport = {
        id: triageSurveyEntry.id,
        createdAt: triageSurveyEntry.createdAt || Date.now(),
        beneficiaryId: beneficiaryData?.beneficiaryId || "261008-58558",
        caseId: caseId,
        name: benFullName,
        campaign: "Inbound Triage",
        form: "Inbound Triage Form",
        submittedDate: dateStr,
        agent: activeAgentId || "Agent 1",
        timeAndDate: `${dateStr} ${timeStr}`,
        details: triageSurveyEntry.details,
      };
      const existingReports = JSON.parse(localStorage.getItem("crm_inbound_triage_reports") || "[]");
      const updatedReports = [globalReport, ...existingReports.filter((r) => r.id !== globalReport.id)];
      localStorage.setItem("crm_inbound_triage_reports", JSON.stringify(updatedReports));
      setTriageReportsList(updatedReports);
      setTriageReportsVersion((v) => v + 1);
      broadcastEvent("CRM_TRIAGE_REPORT_SAVED", { id: globalReport.id, caseId: globalReport.caseId, benId: beneficiaryData?.beneficiaryId });
    } catch (_) {}

    toast.success(`Inbound Triage complete (${urgency}) & automatically saved to Call History!`);
    } catch (err) {
      console.error("Error in saveTriageRecordAutomatically:", err);
    }
  };

  const handleRunInboundTriage = async (overrideContext) => {
    const benFullName = (`${beneficiaryData.firstName || ""} ${beneficiaryData.lastName || ""}`.trim() || beneficiaryData.fullName || beneficiaryData.name || "").trim();
    if (!benFullName || benFullName.toLowerCase() === "beneficiary" || benFullName.toLowerCase() === "name") {
      toast.error("Beneficiary Name is mandatory to save form. Please enter the beneficiary's name first.");
      return;
    }

    const activeCtx = overrideContext || ekmsContext;
    const combinedNotes =
      triageNotes.trim() ||
      activeCtx?.triageState?.clinicalSummary ||
      activeCtx?.triageState?.condition ||
      activeCtx?.triageState?.symptom ||
      "Caller reports health concern and requests clinical assessment.";

    setTriageLoading(true);
    let outcomeToSave = null;
    const currentCaseId = generateNextCaseRef();
    setActiveTriageCaseRef(currentCaseId);

    try {
      const cleanPhone = (beneficiaryData.phoneNumber || "6002283107").replace(/\D/g, "").slice(-10);
      const payload = {
        caller_name: `${beneficiaryData.firstName || ""} ${beneficiaryData.lastName || ""}`.trim() || "Beneficiary Caller",
        phone: cleanPhone || "6002283107",
        age: beneficiaryData.age ? Number(beneficiaryData.age) : 33,
        sex: beneficiaryData.gender || "Male",
        symptom_notes: combinedNotes,
        district: beneficiaryData.district ? String(beneficiaryData.district).trim() : "",
        pincode: beneficiaryData.pinCode ? String(beneficiaryData.pinCode).trim() : "",
        city: beneficiaryData.village || beneficiaryData.block || beneficiaryData.addressLine1 || "",
        severity_reported: activeCtx?.triageState?.severityScore || 7,
        ekms_ai_context: activeCtx,
        source_app: "crm", // CRITICAL: NEVER saves to cases / case logs!
        skip_case_save: true,
        agent_id: activeAgentId,
        case_ref: currentCaseId,
        case_id: currentCaseId,
      };

      const res = await fetch("/api/triage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Triage evaluation failed");
      }

      data.case_ref = currentCaseId;
      data.case_id = currentCaseId;
      data.is_fresh_triage = true;
      data.is_forwarded = false;
      data.booked_appointment = null;
      data.booking = "";
      data.intake = payload;
      data.ekms_ai_context = activeCtx;

      outcomeToSave = data;
      setTriageOutcome(data);
    } catch (err) {
      console.warn("Inbound triage fallback:", err);
      const isRed = combinedNotes.toLowerCase().includes("chest") || combinedNotes.toLowerCase().includes("breath");
      const fallbackOutcome = {
        case_ref: currentCaseId,
        case_id: currentCaseId,
        is_fresh_triage: true,
        is_forwarded: false,
        booked_appointment: null,
        booking: "",
        intake: {
          caller_name: `${beneficiaryData.firstName || ""} ${beneficiaryData.lastName || ""}`.trim() || "Beneficiary",
          phone: (beneficiaryData.phoneNumber || "6002283107").replace(/\D/g, "").slice(-10),
          age: beneficiaryData.age ? Number(beneficiaryData.age) : 33,
          sex: beneficiaryData.gender || "Male",
          symptom_notes: combinedNotes,
          district: beneficiaryData.district ? String(beneficiaryData.district).trim() : "",
          pincode: beneficiaryData.pinCode ? String(beneficiaryData.pinCode).trim() : "",
        },
        triage: {
          urgency_level: isRed ? "Severe" : "Moderate",
          assessed_severity: isRed ? "Severe" : "Moderate",
          urgency_score: isRed ? 10 : 6,
          confidence: "High",
          summary_en: `Patient reported: ${combinedNotes.slice(0, 160)}. Priority clinical consultation indicated.`,
          summary_hi: "चिकित्सीय मूल्यांकन संपन्न; उपयुक्त स्वास्थ्य सुविधा के लिए मार्गदर्शन।",
          recommended_facility_type: isRed ? "ESIC Model Hospital Beltola (24x7 Casualty)" : "104 Health Helpline (Doctor on Call)",
          referral_destination: isRed ? "ESIC Hospital" : "104 Health Helpline",
          recommended_action: isRed ? "Emergency Priority: Proceed immediately to ESIC Hospital casualty or dispatch 108 Emergency Ambulance." : "Transfer call to 104 Health Helpline for 24x7 doctor tele-consultation.",
          red_flags: isRed ? ["Acute symptom onset", "Shortness of breath / chest discomfort"] : ["Symptom persistence"],
          call_108: isRed,
          call_referral_primary: isRed ? "ESIC Hospital" : "104 Health Helpline",
        },
        nearest_facilities: [
          {
            name: "ESIC Model Hospital Beltola",
            type: "ESIC Hospital",
            distance_km: 4.8,
            address: "Beltola, Guwahati, Assam",
          },
          {
            name: "Gauhati Medical College & Hospital (GMCH)",
            type: "Govt Medical College Hospital",
            distance_km: 7.2,
            address: "Bhangagarh, Guwahati, Assam",
          },
          {
            name: "ESIC Dispensary Panbazar",
            type: "ESIC Dispensary",
            distance_km: 11.5,
            address: "Panbazar, Guwahati, Assam",
          },
        ],
      };
      outcomeToSave = fallbackOutcome;
      setTriageOutcome(fallbackOutcome);
    } finally {
      setTriageLoading(false);
    }

    if (outcomeToSave) {
      try {
        const benId = beneficiaryData.beneficiaryId || "session";
        const outcomeWrapper = {
          ...outcomeToSave,
          _cachedAt: Date.now(),
          cachedAt: Date.now(),
        };
        sessionStorage.setItem(`crm_triage_outcome_${benId}`, JSON.stringify(outcomeWrapper));
        localStorage.setItem(`crm_triage_outcome_${benId}`, JSON.stringify(outcomeWrapper));
      } catch (_) {}
      saveTriageRecordAutomatically(outcomeToSave, currentCaseId);
    }
  };
  const DEFAULT_SURVEY_HISTORY = useMemo(() => [], []);


  // Inbound Triage Report states
  const [selectedReport, setSelectedReport] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        const params = new URLSearchParams(window.location.search);
        const rpt = params.get("report");
        if (rpt === "call-log") return "Call Log Report";
        if (rpt === "triage") return "Inbound Triage Report";
      } catch (_) {}
    }
    return null;
  });
  const [triageReportsList, setTriageReportsList] = useState([]);
  const [selectedTriageReportIds, setSelectedTriageReportIds] = useState([]);
  const [triageReportSearchQuery, setTriageReportSearchQuery] = useState("");
  const [triageReportFilterId, setTriageReportFilterId] = useState("");
  const [triageReportFilterCase, setTriageReportFilterCase] = useState("");
  const [triageReportFilterName, setTriageReportFilterName] = useState("");
  const [triageReportFilterForm, setTriageReportFilterForm] = useState("");
  const [triageReportFilterAgent, setTriageReportFilterAgent] = useState("");
  const [deleteTriageModal, setDeleteTriageModal] = useState({
    isOpen: false,
    type: "single",
    id: null,
    caseId: "",
    beneficiaryId: null,
    count: 0,
  });

  // Call Log Report states
  const [callLogsList, setCallLogsList] = useState([]);
  const [selectedCallLogIds, setSelectedCallLogIds] = useState([]);
  const [callLogFilterId, setCallLogFilterId] = useState("");
  const [callLogFilterName, setCallLogFilterName] = useState("");
  const [callLogFilterAgent, setCallLogFilterAgent] = useState("");
  const [callLogFilterCampaign, setCallLogFilterCampaign] = useState("");
  const [deleteCallLogModal, setDeleteCallLogModal] = useState({
    isOpen: false,
    type: "single",
    id: null,
    name: "",
    count: 0,
  });

  const loadAllTriageReports = useCallback(() => {
    if (typeof window === "undefined") return [];
    try {
      // 1. Read tombstone list of deleted report IDs
      let deletedIds = new Set();
      try {
        const delArr = JSON.parse(localStorage.getItem("crm_deleted_report_ids") || "[]");
        if (Array.isArray(delArr)) {
          deletedIds = new Set(delArr.map(String));
        }
      } catch (_) {}

      // Hardcoded seed IDs to purge completely
      const HARDCODED_REPORT_IDS = ["1791623990001", "1791623990002", "1791623000001", "1791623000002", "1791623000003", "1791623000004"];
      HARDCODED_REPORT_IDS.forEach((hid) => deletedIds.add(hid));

      const existing = JSON.parse(localStorage.getItem("crm_inbound_triage_reports") || "[]");
      const reportMap = new Map();
      if (Array.isArray(existing)) {
        existing.forEach((r) => {
          if (r && r.id && !deletedIds.has(String(r.id)) && !HARDCODED_REPORT_IDS.includes(String(r.id))) {
            let normForm = r.form;
            if (!normForm || normForm === "INFORMATION" || normForm === "GRIEVANCES" || normForm === "TRANSFER") {
              normForm = String(r.campaign || "").toUpperCase().includes("ESIC") ? "ESIC Inbound Form" : "Inbound Triage Form";
            }
            const agentName = r.agent || r.admin || (r.details?.responses?.find((x) => x.q === "Attending Agent" || x.q === "Agent")?.a) || "Agent 1";
            reportMap.set(String(r.id), {
              ...r,
              form: normForm,
              caseId: r.caseId || "—",
              agent: agentName,
            });
          }
        });
      }

      let registryMap = new Map();
      try {
        const reg = JSON.parse(localStorage.getItem("crm_beneficiaries_registry") || "[]");
        if (Array.isArray(reg)) {
          reg.forEach((b) => {
            const bId = b.id || b.beneficiaryId;
            const bName = b.fullName || `${b.firstName || ""} ${b.lastName || ""}`.trim() || b.name;
            if (bId) registryMap.set(String(bId), bName);
          });
        }
      } catch (_) {}

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("crm_surveys_ben_")) {
          const benId = key.replace("crm_surveys_ben_", "");
          try {
            const list = JSON.parse(localStorage.getItem(key) || "[]");
            if (Array.isArray(list)) {
              list.forEach((s) => {
                if (isMockSurveyRecord(s)) return;
                if (!s || !s.id || deletedIds.has(String(s.id)) || HARDCODED_REPORT_IDS.includes(String(s.id))) return;
                const sCampaign = String(s.campaign || "");
                const sForm = String(s.form || "");

                // Form name determination
                let displayForm = "Inbound Triage Form";
                if (sCampaign.toUpperCase().includes("ESIC") || sForm.toUpperCase().includes("ESIC") || sForm === "INFORMATION" || sForm === "GRIEVANCES" || sForm === "TRANSFER") {
                  displayForm = "ESIC Inbound Form";
                } else if (sForm.includes("Inbound Triage") || sCampaign.includes("Inbound Triage")) {
                  displayForm = "Inbound Triage Form";
                } else if (sForm) {
                  displayForm = sForm;
                }

                const cId = s.details?.responses?.find((r) => r.q === "Case ID")?.a || s.caseId || (displayForm === "Inbound Triage Form" ? generateNextCaseRef() : "—");
                const benName = registryMap.get(String(benId)) || (benId === "261008-58558" ? "Barby Saikia" : (benId === "261008-56686" ? "Dipak Das" : "Beneficiary"));
                const agentName = s.agent || s.admin || s.attendingAgent || (s.details?.responses?.find((x) => x.q === "Attending Agent" || x.q === "Agent")?.a) || "Agent 1";

                reportMap.set(String(s.id), {
                  id: s.id,
                  beneficiaryId: benId,
                  caseId: cId,
                  name: benName,
                  campaign: s.campaign || (displayForm.includes("ESIC") ? "ESIC INBOUND" : "Inbound Triage"),
                  form: displayForm,
                  submittedDate: s.submittedDate || "10-10-2026",
                  agent: agentName,
                  timeAndDate: s.timeAndDate || `${s.submittedDate || "10-10-2026"} 01:42 PM`,
                  details: s.details,
                  createdAt: typeof s.id === "number" ? s.id : Date.now(),
                });
              });
            }
          } catch (_) {}
        }
      }

      // Ensure every Inbound Triage report has a distinct sequential Case ID (no duplicates)
      const seenCaseIds = new Set();
      const merged = Array.from(reportMap.values())
        .filter((r) => !deletedIds.has(String(r.id)) && !HARDCODED_REPORT_IDS.includes(String(r.id)))
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
        .map((r) => {
          if (r.form === "Inbound Triage Form" || String(r.campaign || "").includes("Inbound Triage")) {
            let cid = r.caseId;
            if (!cid || cid === "—" || cid === "-" || seenCaseIds.has(cid)) {
              cid = generateNextCaseRef();
            }
            seenCaseIds.add(cid);
            let updatedResponses = r.details?.responses;
            if (Array.isArray(updatedResponses)) {
              updatedResponses = updatedResponses.map((q) => {
                if (q.q === "Case ID") return { ...q, a: cid };
                if (q.q?.toLowerCase() === "complaint") return { ...q, q: "Summary" };
                return q;
              });

              // Clean Recommended Facility by Agent if not changed from AI
              const aiRefVal = (updatedResponses.find((q) => q.q === "Primary Referral by AI")?.a || "").toLowerCase().trim();
              updatedResponses = updatedResponses.map((q) => {
                if (q.q === "Recommended Facility by Agent" || q.q === "Recommended Facility") {
                  const val = (q.a || "").trim();
                  const valLower = val.toLowerCase();
                  if (
                    val.toUpperCase().includes("REFER TO DISTRICT HOSPITAL / PUBLIC HEALTHCARE") ||
                    (aiRefVal && (valLower === aiRefVal || (aiRefVal.includes("104") && valLower.includes("104"))))
                  ) {
                    return { ...q, a: "" };
                  }
                }
                return q;
              });

              // Position Primary Referral by AI right above Recommended Facility by Agent
              const refItem = updatedResponses.find((q) => q.q === "Primary Referral by AI");
              const recIdx = updatedResponses.findIndex((q) => q.q === "Recommended Facility by Agent" || q.q === "Recommended Facility");
              if (refItem && recIdx !== -1) {
                const filtered = updatedResponses.filter((q) => q.q !== "Primary Referral by AI");
                const newRecIdx = filtered.findIndex((q) => q.q === "Recommended Facility by Agent" || q.q === "Recommended Facility");
                updatedResponses = [
                  ...filtered.slice(0, newRecIdx),
                  refItem,
                  ...filtered.slice(newRecIdx),
                ];
              }
            }
            return {
              ...r,
              caseId: cid,
              details: {
                ...(r.details || {}),
                callType: "",
                category: "",
                subCategory: "",
                responses: updatedResponses || r.details?.responses,
              },
            };
          }
          return r;
        });
      localStorage.setItem("crm_inbound_triage_reports", JSON.stringify(merged));
      return merged;
    } catch (_) {
      return [];
    }
  }, [isMockSurveyRecord]);

  const loadAllCallLogs = useCallback(() => {
    if (typeof window === "undefined") return [];
    try {
      let deletedCallIds = new Set();
      try {
        const delArr = JSON.parse(localStorage.getItem("crm_deleted_call_ids") || "[]");
        if (Array.isArray(delArr)) {
          deletedCallIds = new Set(delArr.map(String));
        }
      } catch (_) {}

      let registryMap = new Map();
      try {
        const reg = JSON.parse(localStorage.getItem("crm_beneficiaries_registry") || "[]");
        if (Array.isArray(reg)) {
          reg.forEach((b) => {
            const bId = b.id || b.beneficiaryId;
            const bName = b.fullName || `${b.firstName || ""} ${b.lastName || ""}`.trim() || b.name;
            if (bId) registryMap.set(String(bId), bName);
          });
        }
      } catch (_) {}

      const callMap = new Map();

      // 1. Read from crm_all_call_logs
      try {
        const storedAll = JSON.parse(localStorage.getItem("crm_all_call_logs") || "[]");
        if (Array.isArray(storedAll)) {
          storedAll.forEach((c) => {
            if (c && c.id && !deletedCallIds.has(String(c.id))) {
              callMap.set(String(c.id), c);
            }
          });
        }
      } catch (_) {}

      // 2. Scan all crm_call_history_* keys in localStorage
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("crm_call_history_") && !key.startsWith("crm_call_history_synced_")) {
          const benIdOrPhone = key.replace("crm_call_history_", "");
          try {
            const list = JSON.parse(localStorage.getItem(key) || "[]");
            if (Array.isArray(list)) {
              list.forEach((c) => {
                if (!c || !c.id || deletedCallIds.has(String(c.id))) return;
                const bId = c.beneficiaryId || (benIdOrPhone.startsWith("phone_") ? "" : benIdOrPhone);
                const bName = c.fullName || c.name || registryMap.get(String(bId)) || "Beneficiary";
                const isConn = c.callConnected === true || (String(c.status || "").toLowerCase().includes("connected") && !String(c.status || "").toLowerCase().includes("not connected"));
                const dur = String(c.duration || "00:00");
                if (!isConn && (dur === "00:00" || dur === "0")) return;

                callMap.set(String(c.id), {
                  id: c.id,
                  beneficiaryId: bId || "261008-58558",
                  fullName: bName,
                  name: bName,
                  phoneNumber: c.phoneNumber || "+91-7845120147",
                  cleanPhone: c.cleanPhone || "",
                  campaign: c.campaign || "Inbound Triage",
                  date: c.date || "10-10-2026",
                  time: c.time || "01:42 PM",
                  timeAndDate: c.timeAndDate || c.timestamp || `${c.date || "10-10-2026"} ${c.time || "01:42 PM"}`,
                  agent: c.agent || c.attendingAgent || "Agent 1",
                  status: c.status || "Connected",
                  duration: dur || "00:00",
                  notes: c.notes || "",
                  createdAt: c.createdAt ? new Date(c.createdAt).getTime() : (typeof c.id === "number" ? c.id : Date.now()),
                });
              });
            }
          } catch (_) {}
        }
      }

      const rawList = Array.from(callMap.values())
        .filter((c) => !deletedCallIds.has(String(c.id)))
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

      // Deduplicate: If there are dummy placeholder records (duration 00:00 / "Beneficiary form opened")
      // and a completed call exists for that same beneficiary within 3 minutes, remove the dummy!
      const merged = [];
      for (const call of rawList) {
        const dur = String(call.duration || "00:00");
        const isPlaceholder =
          dur === "00:00" ||
          dur === "0" ||
          (call.notes && String(call.notes).includes("Beneficiary form opened"));

        if (isPlaceholder) {
          const callTime = call.createdAt ? new Date(call.createdAt).getTime() : 0;
          const benKey = String(call.beneficiaryId || call.cleanPhone || "");
          const hasRealCall = rawList.some((other) => {
            if (other.id === call.id) return false;
            const otherBenKey = String(other.beneficiaryId || other.cleanPhone || "");
            if (otherBenKey !== benKey) return false;
            const otherDur = String(other.duration || "00:00");
            const isReal = otherDur !== "00:00" && otherDur !== "0";
            const otherTime = other.createdAt ? new Date(other.createdAt).getTime() : 0;
            return isReal && Math.abs(callTime - otherTime) < 3 * 60 * 1000;
          });
          if (hasRealCall) {
            continue; // Skip the duplicate 00:00 placeholder
          }
        }
        merged.push(call);
      }

      localStorage.setItem("crm_all_call_logs", JSON.stringify(merged));
      return merged;
    } catch (_) {
      return [];
    }
  }, []);

  // Sync triage reports and call logs list whenever ActiveNav is Reports
  useEffect(() => {
    if (activeNav === "Reports") {
      if (!selectedReport || selectedReport === "Inbound Triage Report") {
        setTriageReportsList(loadAllTriageReports());
      }
      if (selectedReport === "Call Log Report" || selectedReport === "Beneficiary Call Logs") {
        setCallLogsList(loadAllCallLogs());
      }
    }
  }, [activeNav, selectedReport, loadAllTriageReports, loadAllCallLogs]);

  // Strictly CRM-saved triage consultations ONLY where triage output was generated for this beneficiary
  const crmOnlyCallHistory = useMemo(() => {
    const curBenId = String(beneficiaryData.beneficiaryId || beneficiaryData.id || "").trim();
    const curPhone = (beneficiaryData.phoneNumber || "").replace(/\D/g, "").slice(-10);

    // Read tombstone deleted report IDs
    let deletedReportIds = new Set();
    try {
      const delArr = JSON.parse(localStorage.getItem("crm_deleted_report_ids") || "[]");
      if (Array.isArray(delArr)) {
        deletedReportIds = new Set(delArr.map(String));
      }
    } catch (_) {}

    // Get all triage reports
    const allReports = loadAllTriageReports() || [];

    // Filter strictly for this active beneficiary where triage output was generated
    const benTriageReports = allReports.filter((r) => {
      if (!r || !r.id) return false;
      const rIdStr = String(r.id);
      const rCaseIdStr = r.caseId ? String(r.caseId) : "";
      if (deletedReportIds.has(rIdStr) || (rCaseIdStr && deletedReportIds.has(rCaseIdStr))) {
        return false;
      }

      // Hide present triage case while that triage is in progress
      if (inboundTriageModalOpen) {
        const activeRef = activeTriageCaseRef || triageOutcome?.case_ref || triageOutcome?.case_id;
        if (activeRef && (rCaseIdStr === String(activeRef) || rIdStr === String(activeRef))) {
          return false;
        }
      }

      // Check if it's an inbound triage report (where triage output was generated)
      const isTriage =
        r.form === "Inbound Triage Form" ||
        String(r.campaign || "").includes("Inbound Triage") ||
        (rCaseIdStr && rCaseIdStr.startsWith("CA")) ||
        (Array.isArray(r.details?.responses) && r.details.responses.some((q) => q.q === "Triage Urgency Level" || q.q === "Case ID"));
      if (!isTriage) return false;

      // Match beneficiary ID or phone
      const rBenId = String(r.beneficiaryId || "").trim();
      const rPhone = (r.details?.phone || r.phone || r.cleanPhone || "").toString().replace(/\D/g, "").slice(-10);
      
      const matchBenId = curBenId && rBenId && curBenId === rBenId;
      const matchPhone = curPhone && rPhone && curPhone === rPhone;

      // If active beneficiary has ID or phone, require match
      if (curBenId || curPhone) {
        return Boolean(matchBenId || matchPhone);
      }
      return true;
    });

    // Map to the callerHistory schema expected by AbhaCallerSection
    return benTriageReports.map((r, i) => {
      const responses = Array.isArray(r.details?.responses) ? r.details.responses : [];
      const rawUrgencyVal = responses.find((q) => q.q === "Triage Urgency Level")?.a || r.details?.urgency || r.urgency || "Mild";
      const urgencyVal = normalizeUrgency(rawUrgencyVal);
      const urgencyScoreVal = urgencyVal === "Severe" ? 10 : (urgencyVal === "Moderate" ? 6 : 3);

      const summaryVal = responses.find((q) => q.q === "Summary" || q.q === "Chief Complaint")?.a || r.summary || r.notes || "Inbound triage consultation";
      const navVal = responses.find((q) => q.q === "Recommended Facility by Agent" || q.q === "Primary Referral by AI")?.a || r.navigation || "Triage protocol completed";
      const facilityVal = responses.find((q) => q.q === "Recommended Facility by Agent" || q.q === "Recommended Facility")?.a || responses.find((q) => q.q === "Primary Referral by AI")?.a || "";

      // Canonical Case ID (e.g. CA0183AB01)
      const canonicalCaseId = r.caseId || responses.find((q) => q.q === "Case ID")?.a || (r.id ? `CA${String(r.id).slice(-8)}` : "Case");

      // Timestamp parsing
      let recordTime = r.createdAt || r.id;
      if (!recordTime || isNaN(new Date(recordTime).getTime())) {
        if (r.timeAndDate) {
          const d = new Date(r.timeAndDate);
          if (!isNaN(d.getTime())) recordTime = d.getTime();
        }
      }
      if (!recordTime || isNaN(new Date(recordTime).getTime())) {
        recordTime = Date.now();
      }

      return {
        id: r.id || `crm_triage_${i}`,
        case_ref: canonicalCaseId,
        caseId: canonicalCaseId,
        case_id: canonicalCaseId,
        caller_id: canonicalCaseId, // NEVER beneficiary ID! Always Case ID
        created_at: recordTime,
        createdAt: recordTime,
        timestamp: recordTime,
        caller_name: r.name || beneficiaryData.fullName || `${beneficiaryData.firstName || ""} ${beneficiaryData.lastName || ""}`.trim() || "Beneficiary",
        chief_complaint: summaryVal,
        reason: summaryVal,
        summary: summaryVal,
        urgency_level: urgencyVal,
        urgency: urgencyVal,
        urgency_score: urgencyScoreVal,
        navigation: navVal,
        recommended_action: navVal,
        recommended_facility_type: facilityVal,
      };
    });
  }, [
    triageReportsVersion,
    loadAllTriageReports,
    beneficiaryData.beneficiaryId,
    beneficiaryData.id,
    beneficiaryData.phoneNumber,
    beneficiaryData.fullName,
    beneficiaryData.firstName,
    beneficiaryData.lastName,
    surveyHistory,
    triageReportsList,
    inboundTriageModalOpen,
    activeTriageCaseRef,
    triageOutcome,
  ]);

  const handleDeleteSingleTriageReport = (reportId, benId, caseId) => {
    try {
      const idStr = String(reportId);
      const caseIdStr = caseId ? String(caseId) : null;

      // 1. Permanently add to tombstone deleted IDs list
      let deletedIds = [];
      try {
        deletedIds = JSON.parse(localStorage.getItem("crm_deleted_report_ids") || "[]");
        if (!Array.isArray(deletedIds)) deletedIds = [];
      } catch (_) {}
      if (!deletedIds.includes(idStr)) {
        deletedIds.push(idStr);
      }
      if (caseIdStr && !deletedIds.includes(caseIdStr)) {
        deletedIds.push(caseIdStr);
      }
      localStorage.setItem("crm_deleted_report_ids", JSON.stringify(deletedIds));

      // 2. Remove from crm_inbound_triage_reports
      const stored = JSON.parse(localStorage.getItem("crm_inbound_triage_reports") || "[]");
      const updated = stored.filter((r) => String(r.id) !== idStr && (!caseIdStr || String(r.caseId) !== caseIdStr));
      localStorage.setItem("crm_inbound_triage_reports", JSON.stringify(updated));
      setTriageReportsList(updated);
      setSelectedTriageReportIds((prev) => prev.filter((id) => String(id) !== idStr));

      // 3. Remove across all crm_surveys_ben_* keys in localStorage
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("crm_surveys_ben_")) {
          try {
            const benSurveys = JSON.parse(localStorage.getItem(key) || "[]");
            if (Array.isArray(benSurveys)) {
              const updatedBenSurveys = benSurveys.filter((s) => String(s.id) !== idStr && (!caseIdStr || String(s.caseId) !== caseIdStr));
              if (updatedBenSurveys.length !== benSurveys.length) {
                localStorage.setItem(key, JSON.stringify(updatedBenSurveys));
                const keyBenId = key.replace("crm_surveys_ben_", "");
                if (beneficiaryData?.beneficiaryId === keyBenId) {
                  setSurveyHistory(updatedBenSurveys);
                }
              }
            }
          } catch (_) {}
        }
      }

      // 4. Remove synthetic triage call logs from callHistory state
      setCallHistory((prev) => {
        const next = (prev || []).filter((c) => {
          if (String(c.id) === idStr || String(c.id) === `call_triage_${idStr}`) return false;
          return true;
        });
        if (beneficiaryData?.beneficiaryId) {
          setCachedCrmCallHistory(beneficiaryData.beneficiaryId, next);
        }
        return next;
      });

      try {
        const storedCalls = JSON.parse(localStorage.getItem("crm_all_call_logs") || "[]");
        if (Array.isArray(storedCalls)) {
          const updatedCalls = storedCalls.filter((c) => {
            if (String(c.id) === idStr || String(c.id) === `call_triage_${idStr}`) return false;
            return true;
          });
          localStorage.setItem("crm_all_call_logs", JSON.stringify(updatedCalls));
        }
      } catch (_) {}

      // Bump version to immediately refresh crmOnlyCallHistory
      setTriageReportsVersion((v) => v + 1);
      broadcastEvent("CRM_TRIAGE_REPORT_DELETED", { reportId: idStr, caseId: caseIdStr, benId });

      toast.success("Report record deleted successfully");
    } catch (_) {
      toast.error("Failed to delete report record");
    } finally {
      setDeleteTriageModal({ isOpen: false, type: "single", id: null, caseId: "", beneficiaryId: null, count: 0 });
    }
  };

  const handleBulkDeleteTriageReports = () => {
    try {
      const idsToDelete = new Set(selectedTriageReportIds.map(String));

      // Also find corresponding caseIds
      const casesToDelete = new Set();
      triageReportsList.forEach((r) => {
        if (idsToDelete.has(String(r.id)) && r.caseId) {
          casesToDelete.add(String(r.caseId));
        }
      });

      // 1. Permanently add to tombstone deleted IDs list
      let deletedIds = [];
      try {
        deletedIds = JSON.parse(localStorage.getItem("crm_deleted_report_ids") || "[]");
        if (!Array.isArray(deletedIds)) deletedIds = [];
      } catch (_) {}
      idsToDelete.forEach((id) => {
        if (!deletedIds.includes(id)) deletedIds.push(id);
      });
      casesToDelete.forEach((cid) => {
        if (!deletedIds.includes(cid)) deletedIds.push(cid);
      });
      localStorage.setItem("crm_deleted_report_ids", JSON.stringify(deletedIds));

      // 2. Remove from crm_inbound_triage_reports
      const stored = JSON.parse(localStorage.getItem("crm_inbound_triage_reports") || "[]");
      const updated = stored.filter((r) => !idsToDelete.has(String(r.id)) && (!r.caseId || !casesToDelete.has(String(r.caseId))));
      localStorage.setItem("crm_inbound_triage_reports", JSON.stringify(updated));
      setTriageReportsList(updated);

      // 3. Remove across all crm_surveys_ben_* keys in localStorage
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("crm_surveys_ben_")) {
          try {
            const benSurveys = JSON.parse(localStorage.getItem(key) || "[]");
            if (Array.isArray(benSurveys)) {
              const updatedBenSurveys = benSurveys.filter((s) => !idsToDelete.has(String(s.id)) && (!s.caseId || !casesToDelete.has(String(s.caseId))));
              if (updatedBenSurveys.length !== benSurveys.length) {
                localStorage.setItem(key, JSON.stringify(updatedBenSurveys));
                const keyBenId = key.replace("crm_surveys_ben_", "");
                if (beneficiaryData?.beneficiaryId === keyBenId) {
                  setSurveyHistory(updatedBenSurveys);
                }
              }
            }
          } catch (_) {}
        }
      }

      // 4. Remove synthetic triage call logs from callHistory state
      setCallHistory((prev) => {
        const next = (prev || []).filter((c) => {
          if (idsToDelete.has(String(c.id))) return false;
          const rawId = String(c.id).replace("call_triage_", "");
          if (idsToDelete.has(rawId)) return false;
          return true;
        });
        if (beneficiaryData?.beneficiaryId) {
          setCachedCrmCallHistory(beneficiaryData.beneficiaryId, next);
        }
        return next;
      });

      try {
        const storedCalls = JSON.parse(localStorage.getItem("crm_all_call_logs") || "[]");
        if (Array.isArray(storedCalls)) {
          const updatedCalls = storedCalls.filter((c) => {
            if (idsToDelete.has(String(c.id))) return false;
            const rawId = String(c.id).replace("call_triage_", "");
            if (idsToDelete.has(rawId)) return false;
            return true;
          });
          localStorage.setItem("crm_all_call_logs", JSON.stringify(updatedCalls));
        }
      } catch (_) {}

      // Bump version to immediately refresh crmOnlyCallHistory
      setTriageReportsVersion((v) => v + 1);
      broadcastEvent("CRM_TRIAGE_REPORT_DELETED", { bulkIds: Array.from(idsToDelete) });

      const count = selectedTriageReportIds.length;
      setSelectedTriageReportIds([]);
      toast.success(`${count} reports deleted successfully`);
    } catch (_) {
      toast.error("Failed to delete reports");
    } finally {
      setDeleteTriageModal({ isOpen: false, type: "single", id: null, caseId: "", beneficiaryId: null, count: 0 });
    }
  };

  const filteredTriageReports = useMemo(() => {
    return triageReportsList.filter((item) => {
      if (triageReportFilterId && !String(item.beneficiaryId || "").toLowerCase().includes(triageReportFilterId.toLowerCase())) {
        return false;
      }
      if (triageReportFilterCase && !String(item.caseId || "").toLowerCase().includes(triageReportFilterCase.toLowerCase())) {
        return false;
      }
      if (triageReportFilterName && !String(item.name || "").toLowerCase().includes(triageReportFilterName.toLowerCase())) {
        return false;
      }
      if (triageReportFilterForm && triageReportFilterForm !== "All Forms") {
        if (!String(item.form || "").toLowerCase().includes(triageReportFilterForm.toLowerCase())) {
          return false;
        }
      }
      if (triageReportFilterAgent && !String(item.agent || "").toLowerCase().includes(triageReportFilterAgent.toLowerCase())) {
        return false;
      }
      if (triageReportSearchQuery.trim()) {
        const q = triageReportSearchQuery.toLowerCase().trim();
        const matches =
          String(item.beneficiaryId || "").toLowerCase().includes(q) ||
          String(item.caseId || "").toLowerCase().includes(q) ||
          String(item.name || "").toLowerCase().includes(q) ||
          String(item.form || "").toLowerCase().includes(q) ||
          String(item.submittedDate || "").toLowerCase().includes(q) ||
          String(item.agent || "").toLowerCase().includes(q) ||
          String(item.timeAndDate || "").toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [
    triageReportsList,
    triageReportSearchQuery,
    triageReportFilterId,
    triageReportFilterCase,
    triageReportFilterName,
    triageReportFilterForm,
    triageReportFilterAgent,
  ]);

  const handleDeleteSingleCallLog = (callId, benId) => {
    try {
      const idStr = String(callId);

      // Find the call object to inspect its caseId and beneficiaryId
      const stored = JSON.parse(localStorage.getItem("crm_all_call_logs") || "[]");
      const targetCall = stored.find((c) => String(c.id) === idStr) ||
        callHistory.find((c) => String(c.id) === idStr);
      const caseIdStr = targetCall?.caseId ? String(targetCall.caseId) : "";
      const effectiveBenId = benId || targetCall?.beneficiaryId || beneficiaryData?.beneficiaryId;

      // 1. Add to permanent tombstone list
      let deletedIds = [];
      try {
        deletedIds = JSON.parse(localStorage.getItem("crm_deleted_call_ids") || "[]");
        if (!Array.isArray(deletedIds)) deletedIds = [];
      } catch (_) {}
      if (!deletedIds.includes(idStr)) deletedIds.push(idStr);
      if (idStr.startsWith("call_triage_")) {
        const rawTriageId = idStr.replace("call_triage_", "");
        if (!deletedIds.includes(rawTriageId)) deletedIds.push(rawTriageId);
      }
      if (caseIdStr && !deletedIds.includes(caseIdStr)) {
        deletedIds.push(caseIdStr);
      }
      localStorage.setItem("crm_deleted_call_ids", JSON.stringify(deletedIds));

      // Also ensure caseId is marked in deleted reports if it corresponds to a triage case
      if (caseIdStr) {
        try {
          const delReps = JSON.parse(localStorage.getItem("crm_deleted_report_ids") || "[]");
          if (!delReps.includes(caseIdStr)) {
            delReps.push(caseIdStr);
            localStorage.setItem("crm_deleted_report_ids", JSON.stringify(delReps));
          }
        } catch (_) {}
      }

      // 2. Remove from crm_all_call_logs
      const updated = stored.filter((c) => String(c.id) !== idStr && (!caseIdStr || String(c.caseId || "") !== caseIdStr));
      localStorage.setItem("crm_all_call_logs", JSON.stringify(updated));
      setCallLogsList(updated);
      setSelectedCallLogIds((prev) => prev.filter((id) => String(id) !== idStr));

      // 3. Remove across all crm_call_history_* in localStorage
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("crm_call_history_") && !key.startsWith("crm_call_history_synced_")) {
          try {
            const history = JSON.parse(localStorage.getItem(key) || "[]");
            if (Array.isArray(history)) {
              const updatedHistory = history.filter((c) => String(c.id) !== idStr && (!caseIdStr || String(c.caseId || "") !== caseIdStr));
              if (updatedHistory.length !== history.length) {
                localStorage.setItem(key, JSON.stringify(updatedHistory));
              }
            }
          } catch (_) {}
        }
      }

      // 4. Immediately update active callHistory state
      setCallHistory((prev) => (prev || []).filter((c) => String(c.id) !== idStr && (!caseIdStr || String(c.caseId || "") !== caseIdStr)));

      if (effectiveBenId) {
        try {
          const currentH = JSON.parse(localStorage.getItem(`crm_call_history_${effectiveBenId}`) || "[]");
          const cleanedH = (currentH || []).filter((c) => String(c.id) !== idStr && (!caseIdStr || String(c.caseId || "") !== caseIdStr));
          setCachedCrmCallHistory(effectiveBenId, cleanedH);
        } catch (_) {}
      }

      // 5. Delete from CRM Firestore if present
      try {
        const crmDb = getCrmFirestoreDb();
        if (crmDb) {
          deleteDoc(doc(crmDb, "crm_call_history", idStr)).catch(() => {});
        }
      } catch (_) {}

      setTriageReportsVersion((v) => v + 1);
      broadcastEvent("CRM_CALL_HISTORY_UPDATED", { deletedId: idStr, caseId: caseIdStr });

      toast.success("Call log deleted successfully");
    } catch (_) {
      toast.error("Failed to delete call log");
    } finally {
      setDeleteCallLogModal({ isOpen: false, type: "single", id: null, name: "", count: 0 });
    }
  };

  const handleBulkDeleteCallLogs = () => {
    try {
      const idsToDelete = new Set(selectedCallLogIds.map(String));
      const stored = JSON.parse(localStorage.getItem("crm_all_call_logs") || "[]");
      const casesToDelete = new Set();

      stored.forEach((c) => {
        if (idsToDelete.has(String(c.id)) && c.caseId) {
          casesToDelete.add(String(c.caseId));
        }
      });
      callHistory.forEach((c) => {
        if (idsToDelete.has(String(c.id)) && c.caseId) {
          casesToDelete.add(String(c.caseId));
        }
      });

      // 1. Add to permanent tombstone list
      let deletedIds = [];
      try {
        deletedIds = JSON.parse(localStorage.getItem("crm_deleted_call_ids") || "[]");
        if (!Array.isArray(deletedIds)) deletedIds = [];
      } catch (_) {}
      idsToDelete.forEach((id) => {
        if (!deletedIds.includes(id)) deletedIds.push(id);
        if (id.startsWith("call_triage_")) {
          const rawTriageId = id.replace("call_triage_", "");
          if (!deletedIds.includes(rawTriageId)) deletedIds.push(rawTriageId);
        }
      });
      casesToDelete.forEach((cid) => {
        if (!deletedIds.includes(cid)) deletedIds.push(cid);
      });
      localStorage.setItem("crm_deleted_call_ids", JSON.stringify(deletedIds));

      if (casesToDelete.size > 0) {
        try {
          const delReps = JSON.parse(localStorage.getItem("crm_deleted_report_ids") || "[]");
          casesToDelete.forEach((cid) => {
            if (!delReps.includes(cid)) delReps.push(cid);
          });
          localStorage.setItem("crm_deleted_report_ids", JSON.stringify(delReps));
        } catch (_) {}
      }

      // 2. Remove from crm_all_call_logs
      const updated = stored.filter((c) => !idsToDelete.has(String(c.id)) && (!c.caseId || !casesToDelete.has(String(c.caseId))));
      localStorage.setItem("crm_all_call_logs", JSON.stringify(updated));
      setCallLogsList(updated);

      // 3. Remove across all crm_call_history_* in localStorage
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("crm_call_history_") && !key.startsWith("crm_call_history_synced_")) {
          try {
            const history = JSON.parse(localStorage.getItem(key) || "[]");
            if (Array.isArray(history)) {
              const updatedHistory = history.filter((c) => !idsToDelete.has(String(c.id)) && (!c.caseId || !casesToDelete.has(String(c.caseId))));
              if (updatedHistory.length !== history.length) {
                localStorage.setItem(key, JSON.stringify(updatedHistory));
              }
            }
          } catch (_) {}
        }
      }

      // 4. Immediately update active callHistory state
      setCallHistory((prev) => (prev || []).filter((c) => !idsToDelete.has(String(c.id)) && (!c.caseId || !casesToDelete.has(String(c.caseId)))));

      if (beneficiaryData?.beneficiaryId) {
        try {
          const currentH = JSON.parse(localStorage.getItem(`crm_call_history_${beneficiaryData.beneficiaryId}`) || "[]");
          const cleanedH = (currentH || []).filter((c) => !idsToDelete.has(String(c.id)) && (!c.caseId || !casesToDelete.has(String(c.caseId))));
          setCachedCrmCallHistory(beneficiaryData.beneficiaryId, cleanedH);
        } catch (_) {}
      }

      // 5. Delete from CRM Firestore if present
      try {
        const crmDb = getCrmFirestoreDb();
        if (crmDb) {
          idsToDelete.forEach((id) => {
            deleteDoc(doc(crmDb, "crm_call_history", id)).catch(() => {});
          });
        }
      } catch (_) {}

      const count = selectedCallLogIds.length;
      setSelectedCallLogIds([]);
      setTriageReportsVersion((v) => v + 1);
      broadcastEvent("CRM_CALL_HISTORY_UPDATED", { deletedCount: count });
      toast.success(`${count} call logs deleted successfully`);
    } catch (_) {
      toast.error("Failed to delete call logs");
    } finally {
      setDeleteCallLogModal({ isOpen: false, type: "single", id: null, name: "", count: 0 });
    }
  };

  const filteredCallLogs = useMemo(() => {
    return callLogsList.filter((item) => {
      if (callLogFilterId && !String(item.beneficiaryId || "").toLowerCase().includes(callLogFilterId.toLowerCase())) {
        return false;
      }
      if (callLogFilterName && !String(item.fullName || item.name || "").toLowerCase().includes(callLogFilterName.toLowerCase())) {
        return false;
      }
      if (callLogFilterAgent && !String(item.agent || "").toLowerCase().includes(callLogFilterAgent.toLowerCase())) {
        return false;
      }
      if (callLogFilterCampaign && !String(item.campaign || "").toLowerCase().includes(callLogFilterCampaign.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [callLogsList, callLogFilterId, callLogFilterName, callLogFilterAgent, callLogFilterCampaign]);

  const handleExportCallLogsCsv = () => {
    try {
      if (filteredCallLogs.length === 0) {
        toast.info("No call logs to export");
        return;
      }
      const headers = ["ID", "Beneficiary Name", "Phone Number", "Date and Time", "Agent ID", "Duration", "Campaign", "Status"];
      const rows = filteredCallLogs.map((c) => [
        `"${c.beneficiaryId || ""}"`,
        `"${c.fullName || c.name || ""}"`,
        `"${c.phoneNumber || ""}"`,
        `"${c.timeAndDate || `${c.date || ""} ${c.time || ""}`}"`,
        `"${c.agent || ""}"`,
        `"${c.duration || ""}"`,
        `"${c.campaign || ""}"`,
        `"${c.status || ""}"`,
      ]);
      const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `call_log_report_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Call log report exported successfully");
    } catch (_) {
      toast.error("Failed to export call logs");
    }
  };

  const getBeneficiaryCallTimestamp = useCallback((benId, phoneNumber) => {
    if (typeof window === "undefined") return 0;
    try {
      if (benId) {
        const direct = Number(localStorage.getItem(`crm_ben_last_call_${benId}`) || 0);
        if (direct > 0) return direct;
      }
      const clean = (phoneNumber || "").replace(/\D/g, "").slice(-10);
      if (clean) {
        const directPh = Number(localStorage.getItem(`crm_phone_last_call_${clean}`) || 0);
        if (directPh > 0) return directPh;
      }
      if (benId) {
        const history = getCachedCrmCallHistory(benId);
        if (Array.isArray(history) && history.length > 0) {
          const t = new Date(history[0].createdAt || history[0].timestamp || history[0].date || 0).getTime();
          if (t > 0) return t;
        }
      }
      if (clean) {
        const phHistory = getCachedCrmCallHistory(`phone_${clean}`);
        if (Array.isArray(phHistory) && phHistory.length > 0) {
          const t = new Date(phHistory[0].createdAt || phHistory[0].timestamp || phHistory[0].date || 0).getTime();
          if (t > 0) return t;
        }
      }
      return 0;
    } catch (_) {
      return 0;
    }
  }, []);

  // One-time global purge of legacy mock / default survey records from localStorage for all beneficiaries
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("crm_surveys_ben_")) {
          const val = localStorage.getItem(key);
          if (val) {
            try {
              const list = JSON.parse(val);
              if (Array.isArray(list)) {
                const cleaned = list.filter((it) => !isMockSurveyRecord(it));
                localStorage.setItem(key, JSON.stringify(cleaned));
              }
            } catch (_) {}
          }
        }
      }

      const regVal = localStorage.getItem("crm_beneficiaries_registry");
      if (regVal) {
        try {
          const reg = JSON.parse(regVal);
          if (Array.isArray(reg)) {
            let updated = false;
            const cleanedReg = reg.map((b) => {
              if (b.surveys && Array.isArray(b.surveys)) {
                const cleanedSurveys = b.surveys.filter((it) => !isMockSurveyRecord(it));
                if (cleanedSurveys.length !== b.surveys.length) {
                  updated = true;
                  return { ...b, surveys: cleanedSurveys };
                }
              }
              return b;
            });
            if (updated) {
              localStorage.setItem("crm_beneficiaries_registry", JSON.stringify(cleanedReg));
            }
          }
        } catch (_) {}
      }
    } catch (_) {}
  }, [isMockSurveyRecord]);

  // Secondary sync for survey history to ensure newly added surveys or reports are immediately reflected
  useEffect(() => {
    const benId = beneficiaryData.beneficiaryId;
    if (!benId || typeof window === "undefined") return;
    try {
      const { surveys } = loadBeneficiaryHistory(benId, beneficiaryData.phoneNumber);
      if (surveys && surveys.length > 0) {
        setSurveyHistory(surveys);
      }
    } catch (_) {}
  }, [beneficiaryData.beneficiaryId, beneficiaryData.phoneNumber, loadBeneficiaryHistory]);

  const [esicFormErrors, setEsicFormErrors] = useState({});
  const [esicFormData, setEsicFormData] = useState({
    form: "INFORMATION",
    // INFORMATION questions
    q_awareness: "Yes",
    q_info_type: "1. About ESIS",
    q_coverage: "Yes",
    q_benefit_type: "Medical Benefits",
    q_benefit_others: "",
    q_claims: "Yes",
    q_reimbursements: "Yes",
    q_card_changes: "Name correction",
    q_card_others: "",
    q_followup: "Yes",
    q_rating: "0",
    // TRANSFER fields
    transfer_employer_details: "IP",
    transfer_to: "104",
    transfer_reason: "",
    // GRIEVANCES fields
    grievance_card_no: "",
    grievance_address_employed: "",
    grievance_type: "Facility",
    grievance_others: "",
    // Bottom row fields
    next_followup: "",
    call_type: "", // defaults to empty "Select Call Type"
    category: "",  // defaults to empty "Select Category"
    sub_category: "", // defaults to empty "Select Sub Category"
  });

  const handleSaveEsicSurvey = (e) => {
    e?.preventDefault();

    const benFullName = (`${beneficiaryData.firstName || ""} ${beneficiaryData.lastName || ""}`.trim() || beneficiaryData.fullName || beneficiaryData.name || "").trim();
    if (!benFullName || benFullName.toLowerCase() === "beneficiary" || benFullName.toLowerCase() === "name") {
      toast.error("Beneficiary Name is mandatory to save form. Please enter the beneficiary's name first.");
      return;
    }

    const errors = {};
    if (!esicFormData.call_type || esicFormData.call_type.trim() === "" || esicFormData.call_type === "Select Call Type") {
      errors.call_type = true;
    }
    if (!esicFormData.category || esicFormData.category.trim() === "" || esicFormData.category === "Select Category") {
      errors.category = true;
    }
    if (!esicFormData.sub_category || esicFormData.sub_category.trim() === "" || esicFormData.sub_category === "Select Sub Category") {
      errors.sub_category = true;
    }
    if (esicFormData.form === "GRIEVANCES") {
      if (!esicFormData.grievance_card_no || !esicFormData.grievance_card_no.trim()) {
        errors.grievance_card_no = true;
      }
      if (!esicFormData.grievance_address_employed || !esicFormData.grievance_address_employed.trim()) {
        errors.grievance_address_employed = true;
      }
    }

    if (Object.keys(errors).length > 0) {
      setEsicFormErrors(errors);
      if (errors.grievance_card_no) {
        toast.error("Please enter E-Pehchan Card No.");
      } else if (errors.grievance_address_employed) {
        toast.error("Please enter Address where currently employed.");
      } else if (errors.call_type) {
        toast.error("Please select Call Type to save the survey.");
      } else if (errors.category) {
        toast.error("Please select Category to save the survey.");
      } else if (errors.sub_category) {
        toast.error("Please select Sub Category to save the survey.");
      }
      return;
    }

    setEsicFormErrors({});
    const benId = beneficiaryData.beneficiaryId || "current";

    const responses = [];
    if (esicFormData.form === "TRANSFER") {
      responses.push(
        { q: "Employer's Details", a: esicFormData.transfer_employer_details || "IP" },
        { q: "Transfer to", a: esicFormData.transfer_to || "104" },
        { q: "Reasons for Transfer", a: esicFormData.transfer_reason || "NA" }
      );
    } else if (esicFormData.form === "GRIEVANCES") {
      responses.push(
        { q: "E-Pehchan Card No", a: esicFormData.grievance_card_no },
        { q: "Address where currently employed", a: esicFormData.grievance_address_employed },
        { q: "Grievance type", a: esicFormData.grievance_type || "Facility" },
        { q: "Others, please mention", a: esicFormData.grievance_others || "NA" }
      );
    } else {
      responses.push(
        { q: "Are you aware of the benefits and services of ESIC?", a: esicFormData.q_awareness },
        { q: "2. What kind of information do you want to know about?", a: esicFormData.q_info_type },
        { q: "a) Informed caller about Coverage & Eligibility of Scheme?", a: esicFormData.q_coverage },
        { q: "3. Benefit types", a: esicFormData.q_benefit_type },
        { q: "3.1 Describe, if others.", a: esicFormData.q_benefit_others || "NA" },
        { q: "b) Informed caller about claims?", a: esicFormData.q_claims },
        { q: "c) Informed caller about reimbursements?", a: esicFormData.q_reimbursements },
        { q: "4. E Pehchan Card Changes?", a: esicFormData.q_card_changes },
        { q: "4.1 If others, please specify", a: esicFormData.q_card_others || "NA" },
        { q: "Follow up required?", a: esicFormData.q_followup },
        { q: "Based on the quality of call, how would you rate us?", a: esicFormData.q_rating }
      );
    }

    const activeOp = activeAgentId || (adminLoggedIn ? "Admin 1" : "Agent 1");
    const now = new Date();
    const dateStr = now.toLocaleDateString("en-GB").replace(/\//g, "-");
    const timeStr = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
    const fullDateTime = `${dateStr} ${timeStr}`;

    responses.push(
      { q: "Next Follow-up", a: esicFormData.next_followup || "NA" },
      { q: "Call Type", a: esicFormData.call_type },
      { q: "Category", a: esicFormData.category },
      { q: "Sub Category", a: esicFormData.sub_category },
      { q: "Attending Agent", a: activeOp }
    );

    const newSurvey = {
      id: Date.now(),
      createdAt: Date.now(),
      campaign: "ESIC INBOUND",
      form: "ESIC Inbound Form",
      subForm: esicFormData.form || "INFORMATION",
      followup: esicFormData.form === "INFORMATION" ? (esicFormData.q_followup || "No") : (esicFormData.next_followup ? "Yes" : "No"),
      submittedDate: dateStr,
      agent: activeOp,
      timeAndDate: fullDateTime,
      details: {
        campaign: "ESIC INBOUND",
        callType: esicFormData.call_type,
        category: esicFormData.category,
        subCategory: esicFormData.sub_category,
        responses,
      },
    };

    const updatedSurveys = [newSurvey, ...surveyHistory];
    setSurveyHistory(updatedSurveys);

    try {
      const globalReport = {
        id: newSurvey.id,
        createdAt: newSurvey.createdAt,
        beneficiaryId: benId,
        caseId: "—",
        name: `${beneficiaryData.firstName || ""} ${beneficiaryData.lastName || ""}`.trim() || beneficiaryData.fullName || "Beneficiary",
        campaign: "ESIC INBOUND",
        form: "ESIC Inbound Form",
        submittedDate: dateStr,
        agent: activeOp,
        timeAndDate: fullDateTime,
        details: newSurvey.details,
      };
      const existingReports = JSON.parse(localStorage.getItem("crm_inbound_triage_reports") || "[]");
      const updatedReports = [globalReport, ...existingReports.filter((r) => r.id !== globalReport.id)];
      localStorage.setItem("crm_inbound_triage_reports", JSON.stringify(updatedReports));
      setTriageReportsList(updatedReports);
    } catch (_) {}

    const cleanPhone = (beneficiaryData.phoneNumber || "").replace(/\D/g, "").slice(-10);
    const formattedPhone = cleanPhone ? `+91-${cleanPhone}` : beneficiaryData.phoneNumber;

    // Persist permanently for this beneficiary profile in localStorage
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(`crm_surveys_ben_${benId}`, JSON.stringify(updatedSurveys));
      } catch (_) {}

      // Also persist to the beneficiary registry
      setBeneficiaries((prev) => {
        const updated = prev.map((b) => {
          if (b.id === benId || b.beneficiaryId === benId) {
            return { ...b, surveys: updatedSurveys };
          }
          return b;
        });
        try {
          localStorage.setItem("crm_beneficiaries_registry", JSON.stringify(updated));
        } catch (_) {}
        return updated;
      });
    }

    // Save to second CRM Firebase database (ekms-triage)
    try {
      const crmDb = getCrmFirestoreDb();
      if (crmDb) {
        setDoc(doc(crmDb, "crm_surveys", `survey_${Date.now()}`), {
          beneficiaryId: benId,
          ...newSurvey,
          createdAt: now.toISOString(),
        }).catch((e) => console.warn("Failed saving survey to CRM firestore:", e));
      }
    } catch (err) {
      console.warn("Survey CRM firestore error:", err);
    }

    // Add entry to Call History ONLY if call was actually connected!
    const hasLiveCall = Boolean(czCallActive || activeCallData || (czCallDuration && czCallDuration > 0));
    const hasRecentCompletedCall = Boolean(
      lastConnectedCallRef.current?.connected &&
      (!lastConnectedCallRef.current?.endedAt || Date.now() - lastConnectedCallRef.current.endedAt < 30 * 60 * 1000)
    );
    const isCallConn = hasLiveCall || hasRecentCompletedCall;
    const effectiveDurationSec = czCallDuration > 0
      ? czCallDuration
      : (lastConnectedCallRef.current?.duration || 0);
    if (isCallConn) {
      const callDurationStr = `${String(Math.floor(effectiveDurationSec / 60)).padStart(2, "0")}:${String(effectiveDurationSec % 60).padStart(2, "0")}`;
      const esicCallLog = {
        id: `call_esic_${Date.now()}`,
        beneficiaryId: benId,
        fullName: `${beneficiaryData.firstName || ""} ${beneficiaryData.lastName || ""}`.trim() || "Beneficiary",
        phoneNumber: formattedPhone,
        cleanPhone: cleanPhone,
        type: "Inbound Call",
        callType: "ESIC Inbound",
        campaign: "ESIC INBOUND",
        form: esicFormData.form || "ESIC Inbound Form",
        date: dateStr,
        time: timeStr,
        timestamp: fullDateTime,
        createdAt: now.toISOString(),
        status: "Connected",
        duration: callDurationStr,
        callConnected: true,
        agent: activeAgentId || "Agent 1",
        notes: "Inbound call connected, ESIC Inbound Form filled",
      };

      appendCrmCallLog(esicCallLog);
      const callNowTs = Date.now();
      if (benId) {
        localStorage.setItem(`crm_ben_last_call_${benId}`, String(callNowTs));
      }
      if (cleanPhone) {
        localStorage.setItem(`crm_phone_last_call_${cleanPhone}`, String(callNowTs));
      }
      setBeneficiaries((prev) => {
        const next = prev.map((b) => {
          const bPh = (b.phoneNumber || "").replace(/\D/g, "").slice(-10);
          if ((benId && (b.id === benId || b.beneficiaryId === benId)) || (cleanPhone && bPh === cleanPhone)) {
            return { ...b, lastCallTimestamp: callNowTs, lastCallTime: fullDateTime };
          }
          return b;
        });
        next.sort((a, b) => (b.lastCallTimestamp || 0) - (a.lastCallTimestamp || 0));
        setCachedCrmBeneficiaries(next);
        return [...next];
      });

      setCallHistory((prev) => {
        const forThisBen = prev.filter((h) => !h.beneficiaryId || String(h.beneficiaryId) === String(benId));
        const next = [esicCallLog, ...forThisBen.filter((h) => h.id !== esicCallLog.id)];
        if (benId) setCachedCrmCallHistory(benId, next);
        broadcastEvent("CRM_CALL_HISTORY_UPDATED", {
          benId: benId,
          history: next,
        });
        return next;
      });
      currentCallFormSavedRef.current = true;
    }

    setEsicModalOpen(false);
    toast.success("Survey form saved to beneficiary profile successfully!");
  };

  const updateBeneficiaryField = (field, val) => {
    setBeneficiaryData((prev) => {
      const next = {
        ...prev,
        [field]: val,
      };

      // When district is changed, automatically update pinCode to the representative pincode of that district
      if (field === "district" && val) {
        const cleanD = String(val).toUpperCase().trim();
        const defPin = ASSAM_DISTRICT_DEFAULT_PINS[cleanD];
        if (defPin) {
          next.pinCode = defPin;
        }
      }

      // When pincode is changed with 6 digits, if it belongs to a known district, auto-sync the district
      if (field === "pinCode" && /^\d{6}$/.test(String(val).trim())) {
        const pinStr = String(val).trim();
        for (const [distKey, defPin] of Object.entries(ASSAM_DISTRICT_DEFAULT_PINS)) {
          if (defPin === pinStr) {
            const matchedDist = ASSAM_DISTRICTS.find((d) => d.toUpperCase() === distKey) || distKey;
            next.district = matchedDist;
            break;
          }
        }
      }

      return next;
    });
    if (formErrors[field]) {
      setFormErrors((prev) => ({ ...prev, [field]: false }));
    }
  };

  const handleSaveBeneficiary = () => {
    const missing = [];
    const errors = {};

    if (!beneficiaryData.state?.trim()) {
      missing.push("State");
      errors.state = true;
    }
    if (!beneficiaryData.center?.trim()) {
      missing.push("Center");
      errors.center = true;
    }
    if (!beneficiaryData.phoneNumber?.trim()) {
      missing.push("Phone Number");
      errors.phoneNumber = true;
    }
    if (!beneficiaryData.branching?.trim()) {
      missing.push("Branching");
      errors.branching = true;
    }
    if (!beneficiaryData.firstName?.trim()) {
      missing.push("First Name");
      errors.firstName = true;
    }
    if (!beneficiaryData.gender?.trim()) {
      missing.push("Gender");
      errors.gender = true;
    }
    if (!beneficiaryData.district?.trim()) {
      missing.push("District");
      errors.district = true;
    }

    if (missing.length > 0) {
      setFormErrors(errors);
      toast.error(`Please fill all required (*) fields: ${missing.join(", ")}`);
      return;
    }

    setFormErrors({});
    const cleanPhone = beneficiaryData.phoneNumber.replace(/\D/g, "").slice(-10);
    const formattedPhone = cleanPhone ? `+91-${cleanPhone}` : beneficiaryData.phoneNumber;
    const fullName = `${beneficiaryData.firstName} ${beneficiaryData.lastName || ""}`.trim();
    const id = beneficiaryData.beneficiaryId || `260921-${Math.floor(10000 + Math.random() * 90000)}`;

    const now = new Date();
    const dateStr = now.toLocaleDateString("en-GB").replace(/\//g, "-");
    const timeStr = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
    const fullDateTime = `${dateStr} ${timeStr}`;

    const savedRecord = {
      ...beneficiaryData,
      beneficiaryId: id,
      id: id,
      fullName: fullName,
      phoneNumber: formattedPhone,
      cleanPhone: cleanPhone,
      avatar: fullName.slice(0, 2).toUpperCase() || "BN",
      avatarColor: "bg-[#107c41]",
      assignedTo: activeAgentId,
      timeAgo: "Just now",
      comments: 0,
      registrationDate: beneficiaryData.registrationDate || fullDateTime,
      updatedAt: now.toISOString(),
      updatedDate: dateStr,
      updatedTime: timeStr,
    };

    setBeneficiaries((prev) => {
      const idx = prev.findIndex((b) => b.id === id || (cleanPhone && (b.cleanPhone === cleanPhone || b.phoneNumber?.replace(/\D/g, "").slice(-10) === cleanPhone)));
      let updated;
      if (idx >= 0) {
        updated = [...prev];
        updated[idx] = savedRecord;
      } else {
        updated = [savedRecord, ...prev];
      }
      setCachedCrmBeneficiaries(updated);
      if (cleanPhone) {
        try {
          localStorage.setItem("crm_beneficiary_phone_" + cleanPhone, JSON.stringify(savedRecord));
        } catch (_) {}
      }
      broadcastEvent("CRM_BENEFICIARIES_UPDATED", updated);
      return updated;
    });

    // Persist to the second CRM Firebase database (ekms-triage)
    try {
      const crmDb = getCrmFirestoreDb();
      if (crmDb) {
        setDoc(doc(crmDb, "crm_beneficiaries", String(id)), savedRecord, { merge: true })
          .catch((err) => console.warn("Failed saving beneficiary to second CRM Firestore:", err));
      }
    } catch (err) {
      console.warn("CRM Firestore error:", err);
    }

    toast.success(`Beneficiary ${fullName} saved successfully!`);
    if (typeof window !== "undefined") {
      document.title = `${fullName} - ${id}`;
      try {
        window.history.replaceState({}, '', `/beneficiary?id=${id}`);
      } catch (_) {}
    }
  };

  const handleDeleteBeneficiary = (idToDelete) => {
    // Delete doc from second CRM Firebase database (ekms-triage)
    try {
      const crmDb = getCrmFirestoreDb();
      if (crmDb) {
        deleteDoc(doc(crmDb, "crm_beneficiaries", String(idToDelete))).catch(() => {});
      }
    } catch (_) {}

    let benNameToRemove = "";
    setBeneficiaries((prev) => {
      const ben = prev.find((b) => b.id === idToDelete);
      if (ben) {
        benNameToRemove = (ben.fullName || "").trim().toUpperCase();
        const p = ben.phone || ben.phoneNumber;
        if (p) {
          const cleanPhone = p.replace(/[^0-9]/g, "").slice(-10);
          try {
            localStorage.removeItem(`crm_beneficiary_phone_${cleanPhone}`);
          } catch (_) {}
        }
      }
      const updated = prev.filter((b) => b.id !== idToDelete);
      setCachedCrmBeneficiaries(updated);
      broadcastEvent("CRM_BENEFICIARIES_UPDATED", updated);
      return updated;
    });

    // Record in deleted list so it NEVER reappears as hardcoded
    try {
      const deletedList = JSON.parse(localStorage.getItem("crm_deleted_beneficiaries") || "[]");
      deletedList.push(String(idToDelete).toUpperCase());
      if (benNameToRemove) deletedList.push(benNameToRemove);
      localStorage.setItem("crm_deleted_beneficiaries", JSON.stringify(Array.from(new Set(deletedList))));
    } catch (_) {}

    // Also remove matching tasks from Task List
    setTasks((prev) => {
      const updatedTasks = prev.filter(
        (t) => String(t.id).toUpperCase() !== String(idToDelete).toUpperCase() &&
               (!benNameToRemove || (t.name || t.beneficiaryName || "").trim().toUpperCase() !== benNameToRemove)
      );
      try {
        localStorage.setItem("crm_tasks_registry", JSON.stringify(updatedTasks));
      } catch (_) {}
      return updatedTasks;
    });

    setSelectedBenIds((prev) => {
      const next = new Set(prev);
      next.delete(idToDelete);
      return next;
    });
    setConfirmDeleteModal({ isOpen: false, type: "single", id: null, name: "", count: 0 });
    toast.success("Beneficiary deleted successfully");
    if (beneficiaryViewMode === "form") {
      setBeneficiaryViewMode("list");
      if (typeof window !== "undefined") {
        document.title = "Beneficiary";
        try {
          window.history.pushState({ page: "beneficiary-list" }, '', '/beneficiary');
        } catch (_) {}
      }
    }
  };

  const handleBulkDeleteBeneficiaries = () => {
    if (selectedBenIds.size === 0) return;
    const count = selectedBenIds.size;
    const idsSet = new Set(Array.from(selectedBenIds).map((i) => String(i).toUpperCase()));

    // Delete docs from second CRM Firebase database (ekms-triage)
    try {
      const crmDb = getCrmFirestoreDb();
      if (crmDb) {
        selectedBenIds.forEach((id) => {
          deleteDoc(doc(crmDb, "crm_beneficiaries", String(id))).catch(() => {});
        });
      }
    } catch (_) {}

    const namesToRemove = new Set();
    setBeneficiaries((prev) => {
      prev.forEach((b) => {
        if (selectedBenIds.has(b.id)) {
          if (b.fullName) namesToRemove.add(b.fullName.trim().toUpperCase());
          const p = b.phone || b.phoneNumber;
          if (p) {
            const cleanPhone = p.replace(/[^0-9]/g, "").slice(-10);
            try {
              localStorage.removeItem(`crm_beneficiary_phone_${cleanPhone}`);
            } catch (_) {}
          }
        }
      });
      const updated = prev.filter((b) => !selectedBenIds.has(b.id));
      setCachedCrmBeneficiaries(updated);
      broadcastEvent("CRM_BENEFICIARIES_UPDATED", updated);
      return updated;
    });

    // Record in deleted list so they NEVER reappear as hardcoded
    try {
      const deletedList = JSON.parse(localStorage.getItem("crm_deleted_beneficiaries") || "[]");
      idsSet.forEach((id) => deletedList.push(id));
      namesToRemove.forEach((nm) => deletedList.push(nm));
      localStorage.setItem("crm_deleted_beneficiaries", JSON.stringify(Array.from(new Set(deletedList))));
    } catch (_) {}

    // Also remove matching tasks from Task List
    setTasks((prev) => {
      const updatedTasks = prev.filter(
        (t) => !idsSet.has(String(t.id).toUpperCase()) &&
               !namesToRemove.has((t.name || t.beneficiaryName || "").trim().toUpperCase())
      );
      try {
        localStorage.setItem("crm_tasks_registry", JSON.stringify(updatedTasks));
      } catch (_) {}
      return updatedTasks;
    });

    setSelectedBenIds(new Set());
    setConfirmDeleteModal({ isOpen: false, type: "bulk", id: null, name: "", count: 0 });
    toast.success(`${count} beneficiaries deleted successfully`);
  };

  const handleBulkDeleteTasks = () => {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    const idsSet = new Set(Array.from(selectedIds).map((i) => String(i).toUpperCase()));
    const namesToRemove = new Set();

    tasks.forEach((t) => {
      if (idsSet.has(String(t.id).toUpperCase())) {
        if (t.name) namesToRemove.add(t.name.trim().toUpperCase());
        if (t.beneficiaryName) namesToRemove.add(t.beneficiaryName.trim().toUpperCase());
      }
    });

    // 1. Remove from tasks state & localStorage
    setTasks((prev) => {
      const next = prev.filter((t) => !idsSet.has(String(t.id).toUpperCase()));
      try {
        localStorage.setItem("crm_tasks_registry", JSON.stringify(next));
      } catch (_) {}
      return next;
    });

    // 2. Remove matching beneficiaries from beneficiaries state & cache
    setBeneficiaries((prev) => {
      const next = prev.filter(
        (b) => !idsSet.has(String(b.id).toUpperCase()) &&
               !namesToRemove.has(String(b.fullName || "").trim().toUpperCase())
      );
      setCachedCrmBeneficiaries(next);
      broadcastEvent("CRM_BENEFICIARIES_UPDATED", next);
      return next;
    });

    // 3. Save to crm_deleted_beneficiaries
    try {
      const deletedList = JSON.parse(localStorage.getItem("crm_deleted_beneficiaries") || "[]");
      idsSet.forEach((id) => deletedList.push(id));
      namesToRemove.forEach((nm) => deletedList.push(nm));
      localStorage.setItem("crm_deleted_beneficiaries", JSON.stringify(Array.from(new Set(deletedList))));
    } catch (_) {}

    setSelectedIds(new Set());
    toast.success(`${count} tasks deleted successfully`);
  };

  // Campaigns state
  const [campaigns, setCampaigns] = useState(DEMO_CAMPAIGNS);
  const [campaignSearch, setCampaignSearch] = useState("");

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [idFilter, setIdFilter] = useState("");
  const [campaignFilter, setCampaignFilter] = useState("");
  const [allocatedToFilter, setAllocatedToFilter] = useState("");
  const [descriptionFilter, setDescriptionFilter] = useState("");

  // UI state
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const [currentView, setCurrentView] = useState("List View");
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [selectedCampaignIds, setSelectedCampaignIds] = useState(new Set());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pageSize, setPageSize] = useState(20);
  const [campaignPageSize, setCampaignPageSize] = useState(20);
  const [tagsExpanded, setTagsExpanded] = useState(false);
  const [savedFiltersExpanded, setSavedFiltersExpanded] = useState(false);

  const statusDropdownRef = useRef(null);
  const userMenuRef = useRef(null);
  const viewMenuRef = useRef(null);

  // CZ-Bar popup state (matching media_1791451576722.png and media_1791448189089.png)
  const [czBarOpen, setCzBarOpen] = useState(true);
  const [czBarMinimized, setCzBarMinimized] = useState(false);
  const [czBarPosition, setCzBarPosition] = useState({ x: 800, y: 155 });
  const [czBarDragging, setCzBarDragging] = useState(false);
  const czDragStartRef = useRef({ mouseX: 0, mouseY: 0, startX: 800, startY: 155 });
  const czBarPositionRef = useRef({ x: 800, y: 155 });

  useEffect(() => {
    czBarPositionRef.current = czBarPosition;
  }, [czBarPosition]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("czbar_position");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (typeof parsed?.x === "number" && typeof parsed?.y === "number") {
            const validX = Math.max(10, Math.min(window.innerWidth - 325, parsed.x));
            const validY = Math.max(10, Math.min(window.innerHeight - 50, parsed.y));
            setCzBarPosition({ x: validX, y: validY });
            czBarPositionRef.current = { x: validX, y: validY };
            return;
          }
        }
      } catch (e) {}

      // Default position docked nicely on right side (matching media_1791451576722.png)
      const defaultX = Math.max(20, window.innerWidth - 335);
      const defaultY = Math.min(155, Math.max(20, window.innerHeight - 520));
      setCzBarPosition({ x: defaultX, y: defaultY });
      czBarPositionRef.current = { x: defaultX, y: defaultY };
    }
  }, []);

  const handleCzBarHeaderMouseDown = (e) => {
    if (e.button !== 0) return;
    if (e.target.closest("#czbar-widget-controls")) return;

    setCzBarDragging(true);
    czDragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: czBarPosition.x,
      startY: czBarPosition.y,
    };
    e.preventDefault();
  };

  const handleCzBarHeaderTouchStart = (e) => {
    if (e.target.closest("#czbar-widget-controls")) return;
    if (e.touches && e.touches.length > 0) {
      const touch = e.touches[0];
      setCzBarDragging(true);
      czDragStartRef.current = {
        mouseX: touch.clientX,
        mouseY: touch.clientY,
        startX: czBarPosition.x,
        startY: czBarPosition.y,
      };
    }
  };

  useEffect(() => {
    if (!czBarDragging) return;

    const handleMouseMove = (e) => {
      const deltaX = e.clientX - czDragStartRef.current.mouseX;
      const deltaY = e.clientY - czDragStartRef.current.mouseY;

      const newX = Math.max(0, Math.min(window.innerWidth - 320, czDragStartRef.current.startX + deltaX));
      const newY = Math.max(0, Math.min(window.innerHeight - 50, czDragStartRef.current.startY + deltaY));

      const newPos = { x: newX, y: newY };
      setCzBarPosition(newPos);
      czBarPositionRef.current = newPos;
    };

    const handleTouchMove = (e) => {
      if (e.touches && e.touches.length > 0) {
        const touch = e.touches[0];
        const deltaX = touch.clientX - czDragStartRef.current.mouseX;
        const deltaY = touch.clientY - czDragStartRef.current.mouseY;

        const newX = Math.max(0, Math.min(window.innerWidth - 320, czDragStartRef.current.startX + deltaX));
        const newY = Math.max(0, Math.min(window.innerHeight - 50, czDragStartRef.current.startY + deltaY));

        const newPos = { x: newX, y: newY };
        setCzBarPosition(newPos);
        czBarPositionRef.current = newPos;
      }
    };

    const handleEnd = () => {
      setCzBarDragging(false);
      try {
        localStorage.setItem("czbar_position", JSON.stringify(czBarPositionRef.current));
      } catch (e) {}
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleEnd);
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleEnd);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleEnd);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleEnd);
    };
  }, [czBarDragging]);

  // Minimized CZ-Bar Pill state & dragging
  const [czPillPosition, setCzPillPosition] = useState({ x: null, y: null });
  const [czPillDragging, setCzPillDragging] = useState(false);
  const czPillDragRef = useRef({ mouseX: 0, mouseY: 0, startX: 0, startY: 0, moved: false });
  const czPillPositionRef = useRef({ x: null, y: null });

  useEffect(() => {
    czPillPositionRef.current = czPillPosition;
  }, [czPillPosition]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const savedPill = localStorage.getItem("czbar_pill_position");
        if (savedPill) {
          const parsed = JSON.parse(savedPill);
          if (typeof parsed?.x === "number" && typeof parsed?.y === "number") {
            const validX = Math.max(10, Math.min(window.innerWidth - 180, parsed.x));
            const validY = Math.max(10, Math.min(window.innerHeight - 50, parsed.y));
            setCzPillPosition({ x: validX, y: validY });
            czPillPositionRef.current = { x: validX, y: validY };
            return;
          }
        }
      } catch (_) {}
      const defaultPillX = Math.max(10, window.innerWidth - 220);
      const defaultPillY = Math.max(10, window.innerHeight - 55);
      setCzPillPosition({ x: defaultPillX, y: defaultPillY });
      czPillPositionRef.current = { x: defaultPillX, y: defaultPillY };
    }
  }, []);

  const handleCzPillMouseDown = (e) => {
    if (e.button !== 0) return;
    if (e.target.closest("button")) return;

    const currentX = czPillPosition.x ?? (window.innerWidth - 220);
    const currentY = czPillPosition.y ?? (window.innerHeight - 55);

    czPillDragRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: currentX,
      startY: currentY,
      moved: false,
    };
    setCzPillDragging(true);
    e.preventDefault();
  };

  const handleCzPillTouchStart = (e) => {
    if (e.target.closest("button")) return;
    if (e.touches && e.touches.length > 0) {
      const touch = e.touches[0];
      const currentX = czPillPosition.x ?? (window.innerWidth - 220);
      const currentY = czPillPosition.y ?? (window.innerHeight - 55);

      czPillDragRef.current = {
        mouseX: touch.clientX,
        mouseY: touch.clientY,
        startX: currentX,
        startY: currentY,
        moved: false,
      };
      setCzPillDragging(true);
    }
  };

  useEffect(() => {
    if (!czPillDragging) return;

    const handleMouseMove = (e) => {
      const deltaX = e.clientX - czPillDragRef.current.mouseX;
      const deltaY = e.clientY - czPillDragRef.current.mouseY;

      if (Math.hypot(deltaX, deltaY) > 4) {
        czPillDragRef.current.moved = true;
      }

      const newX = Math.max(10, Math.min(window.innerWidth - 180, czPillDragRef.current.startX + deltaX));
      const newY = Math.max(10, Math.min(window.innerHeight - 50, czPillDragRef.current.startY + deltaY));

      const newPos = { x: newX, y: newY };
      setCzPillPosition(newPos);
      czPillPositionRef.current = newPos;
    };

    const handleTouchMove = (e) => {
      if (e.touches && e.touches.length > 0) {
        const touch = e.touches[0];
        const deltaX = touch.clientX - czPillDragRef.current.mouseX;
        const deltaY = touch.clientY - czPillDragRef.current.mouseY;

        if (Math.hypot(deltaX, deltaY) > 4) {
          czPillDragRef.current.moved = true;
        }

        const newX = Math.max(10, Math.min(window.innerWidth - 180, czPillDragRef.current.startX + deltaX));
        const newY = Math.max(10, Math.min(window.innerHeight - 50, czPillDragRef.current.startY + deltaY));

        const newPos = { x: newX, y: newY };
        setCzPillPosition(newPos);
        czPillPositionRef.current = newPos;
      }
    };

    const handleMouseUp = () => {
      const moved = czPillDragRef.current.moved;
      setCzPillDragging(false);

      if (moved) {
        try {
          localStorage.setItem("czbar_pill_position", JSON.stringify(czPillPositionRef.current));
        } catch (_) {}
      } else {
        // Clicked without dragging: open CZ-Bar big!
        setCzBarMinimized(false);
        setCzBarOpen(true);
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleMouseUp);
    };
  }, [czPillDragging]);

  useEffect(() => {
    czCallModeRef.current = czCallMode;
  }, [czCallMode]);

  useEffect(() => {
    incomingCallRef.current = incomingCall;
  }, [incomingCall]);

  useEffect(() => {
    activeCallRef.current = activeCallData;
  }, [activeCallData]);

  // Active call duration timer
  useEffect(() => {
    if (!czCallActive) return;
    const durTimer = setInterval(() => {
      setCzCallDuration((prev) => {
        const next = prev + 1;
        if (lastConnectedCallRef.current) {
          lastConnectedCallRef.current.duration = next;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(durTimer);
  }, [czCallActive]);

  // Helper to handle incoming call across all channels (BroadcastChannel, Firestore, Storage, Polling)
  // Ensures CZ-Bar call popup window always opens up even if previously closed or minimized
  const handleIncomingCallTrigger = (callData) => {
    if (!callData) return;
    if (activeCallRef.current) return;
    if (incomingCallRef.current && incomingCallRef.current.id === callData.id) return;

    console.log("Incoming call detected! Automatically opening CZ-Bar call popup window:", callData);

    // 1. Force open CZ-Bar call popup window and unminimize it immediately
    setCzBarOpen(true);
    setCzBarMinimized(false);
    setCzCallMode("inbound");
    setActiveNav("Beneficiary");

    // 2. Start ringtone & incoming state
    playRingtone("incoming");
    setIncomingCall(callData);

    const rawPhone = callData.callerInfo?.phone || callData.phoneNumber || "6002283107";
    const cleanPhone = String(rawPhone).replace(/\D/g, "").slice(-10);
    const formattedPhone = cleanPhone ? `+91 ${cleanPhone}` : rawPhone;
    setCzPhoneNumber(formattedPhone);

    // 3. Match existing beneficiary or initialize blank form with caller phone
    let saved = null;
    try {
      const byPhone = localStorage.getItem("crm_beneficiary_phone_" + cleanPhone);
      if (byPhone) {
        saved = JSON.parse(byPhone);
      } else {
        const reg = JSON.parse(localStorage.getItem("crm_beneficiaries_registry") || "[]");
        saved = reg.find((b) => b.cleanPhone === cleanPhone || b.phoneNumber?.replace(/\D/g, "").slice(-10) === cleanPhone);
      }
    } catch (_) {}

    const now = new Date();
    const dateStr = now.toLocaleDateString("en-GB").replace(/\//g, "-");
    const timeStr = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
    const fullDateTime = `${dateStr} ${timeStr}`;

    const activeBenId = (saved && (saved.id || saved.beneficiaryId)) || `261008-${Math.floor(10000 + Math.random() * 90000)}`;
    const callerName = (saved && (saved.fullName || `${saved.firstName || ""} ${saved.lastName || ""}`.trim())) || "Incoming Caller";

    if (saved) {
      setBeneficiaryData({
        ...saved,
        beneficiaryId: saved.id || saved.beneficiaryId,
        phoneNumber: cleanPhone,
      });
      toast.info(`Incoming call from ${callerName} (+91 ${cleanPhone})`);
      if (typeof window !== "undefined") {
        document.title = `${callerName} - ${saved.id || saved.beneficiaryId}`;
      }
    } else {
      setBeneficiaryData({
        beneficiaryId: activeBenId,
        state: "Assam",
        center: "Asam Center 1",
        phoneNumber: cleanPhone,
        branching: "Child",
        firstName: "",
        lastName: "",
        gender: "Male",
        district: "",
        pinCode: "",
        block: "",
        village: "",
        age: "",
        addressLine1: "",
        addressLine2: "",
        typeOfContact: "",
        registrationDate: fullDateTime,
        ipNumber: "4300000000",
        employerName: "",
        parent: "",
      });
      toast.info(`Incoming call (+91 ${cleanPhone}). Opening beneficiary form...`);
      if (typeof window !== "undefined") {
        document.title = `New Beneficiary (+91 ${cleanPhone})`;
      }
    }

    const callNowTs = now.getTime();
    if (activeBenId) {
      localStorage.setItem(`crm_ben_last_call_${activeBenId}`, String(callNowTs));
    }
    if (cleanPhone) {
      localStorage.setItem(`crm_phone_last_call_${cleanPhone}`, String(callNowTs));
    }

    setBeneficiaries((prev) => {
      let matched = false;
      const next = prev.map((b) => {
        const bPh = (b.phoneNumber || "").replace(/\D/g, "").slice(-10);
        if ((activeBenId && (b.id === activeBenId || b.beneficiaryId === activeBenId)) || (cleanPhone && bPh === cleanPhone)) {
          matched = true;
          return {
            ...b,
            lastCallTimestamp: callNowTs,
            lastCallTime: fullDateTime,
          };
        }
        return b;
      });
      if (!matched && activeBenId) {
        next.unshift({
          id: activeBenId,
          beneficiaryId: activeBenId,
          fullName: callerName,
          phoneNumber: formattedPhone,
          state: "Assam",
          center: "Asam Center 1",
          branching: "Child",
          registrationDate: dateStr + " " + timeStr,
          lastCallTimestamp: callNowTs,
          lastCallTime: fullDateTime,
        });
      }
      next.sort((a, b) => (b.lastCallTimestamp || 0) - (a.lastCallTimestamp || 0));
      setCachedCrmBeneficiaries(next);
      return [...next];
    });

    currentCallFormSavedRef.current = false;
    currentCallBenIdRef.current = activeBenId;
    setBeneficiaryViewMode("form");
  };

  const recordCallIfNoFormFilled = (finalDurationSec) => {
    if (currentCallFormSavedRef.current) return;

    const durationSec = Math.max(
      finalDurationSec || 0,
      czCallDuration || 0,
      lastConnectedCallRef.current?.duration || 0
    );

    // Call must have actually been connected (duration > 0)
    if (durationSec <= 0) return;

    currentCallFormSavedRef.current = true;

    const now = new Date();
    const dateStr = now.toLocaleDateString("en-GB").replace(/\//g, "-");
    const timeStr = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
    const fullDateTime = `${dateStr} ${timeStr}`;
    const callDurationStr = `${String(Math.floor(durationSec / 60)).padStart(2, "0")}:${String(durationSec % 60).padStart(2, "0")}`;

    const activeBenId = currentCallBenIdRef.current || beneficiaryData.beneficiaryId;
    const cleanPhone = (beneficiaryData.phoneNumber || activeCallData?.phoneNumber || activeCallData?.phone || incomingCall?.phoneNumber || incomingCall?.phone || "6002283107").replace(/\D/g, "").slice(-10);
    const callerName = `${beneficiaryData.firstName || ""} ${beneficiaryData.lastName || ""}`.trim() || beneficiaryData.fullName || beneficiaryData.name || "Beneficiary";

    const noFormCallLog = {
      id: `call_${Date.now()}`,
      beneficiaryId: activeBenId,
      caseId: "",
      fullName: callerName,
      phoneNumber: cleanPhone ? `+91-${cleanPhone}` : "+91-6002283107",
      cleanPhone: cleanPhone,
      type: "Inbound Call",
      callType: "",
      category: "",
      subCategory: "",
      campaign: "Inbound Triage",
      date: dateStr,
      time: timeStr,
      timestamp: fullDateTime,
      createdAt: now.toISOString(),
      status: "Connected",
      duration: callDurationStr,
      callConnected: true,
      agent: activeAgentId || (adminLoggedIn ? "Admin 2" : "Agent 1"),
      notes: "Inbound call connected, no form filled",
    };

    appendCrmCallLog(noFormCallLog);

    const callNowTs = now.getTime();
    if (activeBenId) {
      localStorage.setItem(`crm_ben_last_call_${activeBenId}`, String(callNowTs));
    }

    setBeneficiaries((prev) => {
      const next = prev.map((b) => {
        if (activeBenId && (b.id === activeBenId || b.beneficiaryId === activeBenId)) {
          return { ...b, lastCallTimestamp: callNowTs, lastCallTime: fullDateTime };
        }
        return b;
      });
      next.sort((a, b) => (b.lastCallTimestamp || 0) - (a.lastCallTimestamp || 0));
      setCachedCrmBeneficiaries(next);
      return [...next];
    });

    setCallHistory((prev) => {
      const forThisBen = prev.filter((h) => !h.beneficiaryId || String(h.beneficiaryId) === String(activeBenId));
      const next = [noFormCallLog, ...forThisBen.filter((h) => h.id !== noFormCallLog.id)];
      if (activeBenId) {
        setCachedCrmCallHistory(activeBenId, next);
      }
      broadcastEvent("CRM_CALL_HISTORY_UPDATED", {
        benId: activeBenId,
        history: next,
      });
      return next;
    });
    setCallHistoryExpanded(true);

    try {
      const crmDb = getCrmFirestoreDb();
      if (crmDb) {
        setDoc(doc(crmDb, "crm_call_history", noFormCallLog.id), noFormCallLog).catch(() => {});
      }
    } catch (_) {}
  };

  const handleCallEndedSignal = () => {
    stopRingtone();
    const finalDur = czCallDuration;
    if (lastConnectedCallRef.current) {
      lastConnectedCallRef.current.duration = Math.max(finalDur, lastConnectedCallRef.current.duration || 0);
      lastConnectedCallRef.current.endedAt = Date.now();
    }
    recordCallIfNoFormFilled(finalDur);
    setIncomingCall(null);
    setActiveCallData(null);
    setCzCallActive(false);
    setIsMuted(false);
    setIsOnHold(false);
    setCzCallDuration(0);
    setCzFreeSeconds(0);
  };

  // Cross-tab & Multi-channel call listener
  useEffect(() => {
    if (typeof window === "undefined") return;

    let bChannel;
    let audioChannel;
    let unsubFirestore = null;
    let unsubSync = null;

    try {
      bChannel = new BroadcastChannel("ekms-call-channel");
      callChannelRef.current = bChannel;

      audioChannel = new BroadcastChannel("ekms-call-audio");
      audioChannelRef.current = audioChannel;

      bChannel.onmessage = (event) => {
        const msg = event.data;
        if (!msg) return;

        // 1. Incoming Call Signal
        if (msg.action === "initiate" || msg.type === "initiate" || msg.action === "incoming_call" || msg.type === "incoming_call" || msg.action === "call") {
          const callData = msg.data ? { ...msg.data, id: msg.callId } : { id: msg.callId, phoneNumber: msg.phoneNumber || msg.phone };
          handleIncomingCallTrigger(callData);
        }

        // 1.5 Call claimed by Home page (Triage)
        if (msg.action === "call_claimed" || msg.type === "call_claimed") {
          if (msg.claimedBy && msg.claimedBy !== "crm") {
            handleCallEndedSignal();
          }
        }

        // 2. Caller Hangup / Reject
        if (msg.action === "hangup" || msg.action === "reject" || msg.type === "hangup") {
          handleCallEndedSignal();
        }
      };

      audioChannel.onmessage = (event) => {
        if (event.data?.type === "hangup") {
          handleCallEndedSignal();
        }
      };
    } catch (e) {}

    // 3. Firestore Real-time Listener on ringing calls
    try {
      const db = getFirestoreDb();
      if (db) {
        const q = query(collection(db, "calls"), where("status", "==", "ringing"));
        unsubFirestore = onSnapshot(
          q,
          (snapshot) => {
            snapshot.docChanges().forEach((change) => {
              if (change.type === "added" || change.type === "modified") {
                const data = change.doc.data();
                if (data && data.status === "ringing") {
                  handleIncomingCallTrigger({ ...data, id: change.doc.id });
                }
              }
            });
          },
          (err) => console.warn("Firestore call snapshot warning:", err)
        );
      }
    } catch (e) {}

    // 4. Cross-tab Storage Listener (instant wakeup across browser tabs)
    const handleStorageEvent = (e) => {
      if (e.key === "ekms_incoming_call") {
        if (e.newValue) {
          try {
            const data = JSON.parse(e.newValue);
            if (data && data.status !== "ended") {
              handleIncomingCallTrigger(data);
            }
          } catch (_) {}
        } else {
          handleCallEndedSignal();
        }
      }
    };
    window.addEventListener("storage", handleStorageEvent);

    // 5. BroadcastSync Subscribe
    try {
      unsubSync = subscribeToSync((event) => {
        if (event.type === "incoming_call" || event.type === "initiate") {
          handleIncomingCallTrigger(event.payload || event);
        } else if (event.type === "hangup") {
          handleCallEndedSignal();
        }
      });
    } catch (_) {}

    // 6. Polling fallback to /api/call/signal
    const pollTimer = setInterval(async () => {
      try {
        const res = await fetch("/api/call/signal?action=poll&targetAgent=Agent%201");
        const data = await res.json();
        if (data && data.status === "ringing" && data.id) {
          if (!incomingCallRef.current && !activeCallRef.current) {
            handleIncomingCallTrigger(data);
          }
        } else if (data && data.status === "ended") {
          if (incomingCallRef.current || activeCallRef.current) {
            handleCallEndedSignal();
          }
        }
      } catch (e) {}
    }, 1500);

    return () => {
      clearInterval(pollTimer);
      window.removeEventListener("storage", handleStorageEvent);
      if (typeof unsubFirestore === "function") unsubFirestore();
      if (typeof unsubSync === "function") unsubSync();
      stopRingtone();
      bChannel?.close();
      audioChannel?.close();
    };
  }, []);

  const handleToggleMute = (e) => {
    e?.stopPropagation();
    setIsMuted((prev) => !prev);
  };

  const handleToggleHold = (e) => {
    e?.stopPropagation();
    const nextHold = !isOnHold;
    setIsOnHold(nextHold);
    const callId = activeCallData?.id || activeCallData?.callId || incomingCall?.id || incomingCall?.callId;
    if (callChannelRef.current && callId) {
      callChannelRef.current.postMessage({
        action: nextHold ? "hold" : "resume",
        callId,
      });
    }
  };

  const handleAcceptIncomingCall = () => {
    stopRingtone();
    if (!incomingCall) return;
    setActiveNav("Beneficiary");

    const callId = incomingCall.id || incomingCall.callId;
    if (callChannelRef.current && callId) {
      callChannelRef.current.postMessage({
        action: "call_claimed",
        type: "call_claimed",
        claimedBy: "crm",
        callId,
      });
      callChannelRef.current.postMessage({
        action: "call_accepted",
        callId,
      });
      callChannelRef.current.postMessage({
        action: "answer",
        callId,
        data: { status: "connected" },
      });
    }
    if (audioChannelRef.current && callId) {
      audioChannelRef.current.postMessage({
        type: "call_accepted",
        callId,
      });
    }

    if (callId) {
      try {
        fetch("/api/call/signal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "answer", callId, data: { status: "connected" } }),
        }).catch(() => {});
      } catch (e) {}

      try {
        const db = getFirestoreDb();
        if (db) {
          updateDoc(doc(db, "calls", callId), {
            status: "connected",
            updatedAt: Date.now(),
          }).catch(() => {});
        }
      } catch (e) {}
    }

    lastConnectedCallRef.current = {
      connected: true,
      callId: incomingCall?.id || incomingCall?.callId || `call_${Date.now()}`,
      phoneNumber: incomingCall?.phoneNumber || incomingCall?.phone,
      startedAt: Date.now(),
      duration: 0,
    };
    setActiveCallData(incomingCall);
    setIncomingCall(null);
    setCzCallActive(true);
    setCzCallDuration(0);
  };

  const handleRejectIncomingCall = () => {
    stopRingtone();
    const callId = incomingCall?.id || incomingCall?.callId;
    if (callChannelRef.current && callId) {
      callChannelRef.current.postMessage({
        action: "reject",
        callId,
      });
      callChannelRef.current.postMessage({
        action: "hangup",
        callId,
      });
    }
    if (audioChannelRef.current && callId) {
      audioChannelRef.current.postMessage({
        type: "hangup",
        callId,
      });
    }

    if (callId) {
      try {
        fetch("/api/call/signal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "hangup", callId }),
        }).catch(() => {});
      } catch (e) {}

      try {
        const db = getFirestoreDb();
        if (db) {
          updateDoc(doc(db, "calls", callId), {
            status: "ended",
            updatedAt: Date.now(),
          }).catch(() => {});
        }
      } catch (e) {}
    }

    setIncomingCall(null);
    setCzCallActive(false);
  };

  const handleEndActiveCall = () => {
    stopRingtone();
    const finalDur = czCallDuration;
    if (lastConnectedCallRef.current) {
      lastConnectedCallRef.current.duration = Math.max(finalDur, lastConnectedCallRef.current.duration || 0);
      lastConnectedCallRef.current.endedAt = Date.now();
    }
    recordCallIfNoFormFilled(finalDur);
    const callId = activeCallData?.id || activeCallData?.callId || incomingCall?.id || incomingCall?.callId;

    if (callChannelRef.current && callId) {
      callChannelRef.current.postMessage({
        action: "hangup",
        callId,
      });
    }
    if (audioChannelRef.current && callId) {
      audioChannelRef.current.postMessage({
        type: "hangup",
        callId,
      });
    }

    if (callId) {
      try {
        fetch("/api/call/signal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "hangup", callId }),
        }).catch(() => {});
      } catch (e) {}

      try {
        const db = getFirestoreDb();
        if (db) {
          updateDoc(doc(db, "calls", callId), {
            status: "ended",
            updatedAt: Date.now(),
          }).catch(() => {});
        }
      } catch (e) {}
    }

    setActiveCallData(null);
    setIncomingCall(null);
    setCzCallActive(false);
    setCzCallDuration(0);
    setCzFreeSeconds(0);
  };

  const toggleCallMode = () => {
    setCzCallMode((prev) => {
      const next = prev === "outbound" ? "inbound" : "outbound";
      if (next === "inbound") {
        setCzFreeSeconds(2); // Starts at 00:00:02 matching media_1791448528378.png
      } else {
        stopRingtone();
        setIncomingCall(null);
        setCzFreeSeconds(427); // 00:07:07 matching media_1791448189089.png
      }
      return next;
    });
  };

  // Live Free Time timer increment
  useEffect(() => {
    const timer = setInterval(() => {
      setCzFreeSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatCzTime = (totalSec) => {
    const h = String(Math.floor(totalSec / 3600)).padStart(2, "0");
    const m = String(Math.floor((totalSec % 3600) / 60)).padStart(2, "0");
    const s = String(totalSec % 60).padStart(2, "0");
    return `${h}:${m}:${s}`;
  };

  const handleCzDial = () => {
    const dialed = czPhoneNumber.trim() || "9876543210";
    if (!czPhoneNumber.trim()) {
      setCzPhoneNumber("9876543210");
    }
    lastConnectedCallRef.current = {
      connected: true,
      callId: `call_dial_${Date.now()}`,
      phoneNumber: dialed,
      startedAt: Date.now(),
      duration: 0,
    };
    setCzCallActive(true);
    setCzCallDuration(0);
  };

  const handleCzHangup = () => {
    handleEndActiveCall();
  };

  // Close menus on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(e.target)) {
        setStatusDropdownOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
      if (viewMenuRef.current && !viewMenuRef.current.contains(e.target)) {
        setViewMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter Tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((rec) => {
      if (statusFilter && rec.status.toLowerCase() !== statusFilter.toLowerCase()) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = (rec.name || rec.beneficiaryName || "").toLowerCase().includes(q);
        const matchesCampaign = (rec.campaign || "").toLowerCase().includes(q);
        const matchesId = (rec.id || "").toLowerCase().includes(q);
        if (!matchesName && !matchesCampaign && !matchesId) return false;
      }
      if (idFilter.trim() && !(rec.id || "").toLowerCase().includes(idFilter.toLowerCase().trim())) return false;
      if (campaignFilter.trim() && !(rec.campaign || "").toLowerCase().includes(campaignFilter.toLowerCase().trim())) return false;
      if (descriptionFilter.trim() && !(rec.name || rec.beneficiaryName || "").toLowerCase().includes(descriptionFilter.toLowerCase().trim())) return false;
      return true;
    });
  }, [tasks, statusFilter, searchQuery, idFilter, campaignFilter, descriptionFilter]);

  // Filter Campaigns
  const filteredCampaigns = useMemo(() => {
    return campaigns.filter((c) => {
      if (campaignSearch.trim()) {
        const q = campaignSearch.toLowerCase().trim();
        return c.name.toLowerCase().includes(q) || c.center.toLowerCase().includes(q) || c.id.toLowerCase().includes(q);
      }
      return true;
    });
  }, [campaigns, campaignSearch]);

  const totalInCurrentStatus = useMemo(() => {
    return tasks.filter((r) => r.status.toLowerCase() === statusFilter.toLowerCase()).length;
  }, [tasks, statusFilter]);

  // Checkbox handlers
  const toggleSelectAllTasks = () => {
    if (selectedIds.size === filteredTasks.length && filteredTasks.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredTasks.map((r) => r.id)));
    }
  };

  const toggleSelectTaskRow = (id, e) => {
    e?.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllCampaigns = () => {
    if (selectedCampaignIds.size === filteredCampaigns.length && filteredCampaigns.length > 0) {
      setSelectedCampaignIds(new Set());
    } else {
      setSelectedCampaignIds(new Set(filteredCampaigns.map((c) => c.id)));
    }
  };

  const toggleSelectCampaignRow = (id, e) => {
    e?.stopPropagation();
    setSelectedCampaignIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Heart toggle
  const toggleHeart = (id, e) => {
    e?.stopPropagation();
    setTasks((prev) => {
      const next = prev.map((r) => (r.id === id ? { ...r, hasHeart: !r.hasHeart } : r));
      try {
        localStorage.setItem("crm_tasks_registry", JSON.stringify(next));
      } catch (_) {}
      return next;
    });
  };

  // Filter & Sort Beneficiaries
  const filteredBeneficiaries = useMemo(() => {
    let list = beneficiaries.filter((b) => {
      if (benIdFilter.trim() && !b.id.toLowerCase().includes(benIdFilter.toLowerCase().trim())) return false;
      if (benPhoneFilter.trim() && !b.phoneNumber.toLowerCase().includes(benPhoneFilter.toLowerCase().trim())) return false;
      if (benNameFilter.trim() && !b.fullName.toLowerCase().includes(benNameFilter.toLowerCase().trim())) return false;
      if (benDistrictFilter.trim() && (b.district || "Tinsukia").toLowerCase() !== benDistrictFilter.toLowerCase().trim()) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const match = b.fullName.toLowerCase().includes(q) || b.id.toLowerCase().includes(q) || b.phoneNumber.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });

    list.sort((a, b) => {
      let valA = a.id;
      let valB = b.id;
      if (benSortField === "Full Name") {
        valA = a.fullName.toLowerCase();
        valB = b.fullName.toLowerCase();
        if (valA < valB) return benSortOrder === "asc" ? -1 : 1;
        if (valA > valB) return benSortOrder === "asc" ? 1 : -1;
      } else if (benSortField === "Registration Date") {
        valA = a.registrationDate;
        valB = b.registrationDate;
        if (valA < valB) return benSortOrder === "asc" ? -1 : 1;
        if (valA > valB) return benSortOrder === "asc" ? 1 : -1;
      } else if (benSortField === "Phone Number") {
        valA = a.phoneNumber;
        valB = b.phoneNumber;
        if (valA < valB) return benSortOrder === "asc" ? -1 : 1;
        if (valA > valB) return benSortOrder === "asc" ? 1 : -1;
      } else if (benSortField === "ID") {
        valA = a.id;
        valB = b.id;
        if (valA < valB) return benSortOrder === "asc" ? -1 : 1;
        if (valA > valB) return benSortOrder === "asc" ? 1 : -1;
      } else {
        // "Created On" / default: arrange on the basis of recent calls (recent call on top)
        const callTimeA = a.lastCallTimestamp || getBeneficiaryCallTimestamp(a.id, a.phoneNumber) || 0;
        const callTimeB = b.lastCallTimestamp || getBeneficiaryCallTimestamp(b.id, b.phoneNumber) || 0;
        if (callTimeA !== callTimeB) {
          return benSortOrder === "asc" ? callTimeA - callTimeB : callTimeB - callTimeA;
        }
        // Fallback to registration or creation timestamp
        const regA = new Date(a.registrationDate || a.createdAt || 0).getTime() || 0;
        const regB = new Date(b.registrationDate || b.createdAt || 0).getTime() || 0;
        if (regA !== regB) {
          return benSortOrder === "asc" ? regA - regB : regB - regA;
        }
        if (valA < valB) return benSortOrder === "asc" ? -1 : 1;
        if (valA > valB) return benSortOrder === "asc" ? 1 : -1;
      }
      return 0;
    });

    return list;
  }, [beneficiaries, benIdFilter, benPhoneFilter, benNameFilter, benDistrictFilter, searchQuery, benSortField, benSortOrder, getBeneficiaryCallTimestamp]);

  const toggleSelectAllBeneficiaries = () => {
    if (selectedBenIds.size === filteredBeneficiaries.length && filteredBeneficiaries.length > 0) {
      setSelectedBenIds(new Set());
    } else {
      setSelectedBenIds(new Set(filteredBeneficiaries.map((b) => b.id)));
    }
  };

  const toggleSelectBenRow = (id, e) => {
    e?.stopPropagation();
    setSelectedBenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleLikeBenRow = (id, e) => {
    e?.stopPropagation();
    setLikedBenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const populateBeneficiaryForm = (ben) => {
    if (!ben) return;
    const benId = ben.id || ben.beneficiaryId || "";
    const cleanPh = (ben.phoneNumber || ben.phone || "").replace(/\D/g, "").slice(-10);
    const { calls: bCalls, surveys: bSurveys } = loadBeneficiaryHistory(benId, cleanPh);
    setCallHistory(bCalls || []);
    setSurveyHistory(bSurveys || []);
    setBeneficiaryData({
      beneficiaryId: benId,
      state: ben.state || "Assam",
      center: ben.center || "Asam Center 1",
      phoneNumber: (ben.phoneNumber || ben.phone || "").replace("+91-", "").replace("+91", "").trim(),
      branching: ben.branching || "Child",
      firstName: ben.firstName || ben.fullName?.split(" ")[0] || ben.fullName || "",
      lastName: ben.lastName || ben.fullName?.split(" ").slice(1).join(" ") || "",
      gender: ben.gender || "Male",
      district: ben.district || "",
      pinCode: ben.pinCode || "",
      block: ben.block || "",
      village: ben.village || "",
      age: ben.age || "0",
      addressLine1: ben.addressLine1 || "",
      addressLine2: ben.addressLine2 || "",
      typeOfContact: ben.typeOfContact || "",
      registrationDate: ben.registrationDate || "",
      ipNumber: ben.ipNumber || "4300000000",
      employerName: ben.employerName || "",
      parent: ben.parent || ben.fullName || "",
    });
    setBeneficiaryViewMode("form");
  };

  const handleOpenBeneficiaryDetail = (ben) => {
    populateBeneficiaryForm(ben);
    if (typeof window !== "undefined") {
      document.title = `${ben.fullName || "Beneficiary"} - ${ben.id}`;
      try {
        window.history.pushState({ type: "beneficiary-form", id: ben.id }, '', `/beneficiary?id=${ben.id}`);
      } catch (err) {}
    }
  };

  const handleOpenTaskBeneficiary = (rec, e) => {
    e?.stopPropagation();
    const benName = (rec.name || rec.beneficiaryName || "").trim();
    // 1. Look up in active beneficiaries state
    let ben = beneficiaries.find(
      (b) => String(b.id).toUpperCase() === String(rec.id).toUpperCase() ||
             b.fullName?.trim().toUpperCase() === benName.toUpperCase()
    );
    // 2. Look up in DEMO_BENEFICIARIES
    if (!ben) {
      ben = DEMO_BENEFICIARIES.find(
        (b) => String(b.id).toUpperCase() === String(rec.id).toUpperCase() ||
               b.fullName?.trim().toUpperCase() === benName.toUpperCase()
      );
    }
    // 3. Fallback: generate dynamic record with random Assam district and Indian phone number
    if (!ben) {
      const parts = benName.split(" ");
      const firstName = parts.length > 1 ? parts.slice(0, -1).join(" ") : parts[0] || "Beneficiary";
      const lastName = parts.length > 1 ? parts[parts.length - 1] : "";
      const dist = ASSAM_DISTRICTS[Math.floor(Math.random() * ASSAM_DISTRICTS.length)] || "Kamrup Metro";
      const randDigits = String(Math.floor(10000000 + Math.random() * 90000000));
      const phone = `+91 98${randDigits.slice(0, 3)} ${randDigits.slice(3)}`;
      ben = {
        id: rec.id || `260921-${Math.floor(10000 + Math.random() * 90000)}`,
        beneficiaryId: rec.id || `260921-${Math.floor(10000 + Math.random() * 90000)}`,
        fullName: benName,
        firstName,
        lastName,
        state: "Assam",
        center: "Asam Center 1",
        phoneNumber: phone,
        cleanPhone: `98${randDigits}`,
        district: dist,
        branching: "Child",
        registrationDate: rec.dueDate ? `${rec.dueDate} 10:00` : "11-10-2026 14:30",
        gender: "Male",
        age: "35",
        pinCode: "781001",
        block: dist,
        village: dist,
        typeOfContact: "Self",
        ipNumber: "4300000000",
        parent: benName,
        employerName: "ESIC Assam",
        timeAgo: rec.timeAgo || "1 w",
        comments: rec.comments || 0,
        hasHeart: !!rec.hasHeart,
      };
      // Also add to dynamic beneficiaries list and update cache
      setBeneficiaries((prev) => {
        const next = [ben, ...prev];
        setCachedCrmBeneficiaries(next);
        return next;
      });
    }

    setActiveNav("Beneficiary");
    handleOpenBeneficiaryDetail(ben);
  };

  // Browser Arrow (Back / Forward) navigation support via popstate
  useEffect(() => {
    const handlePopState = () => {
      if (typeof window === "undefined") return;
      const path = window.location.pathname;
      const search = window.location.search;
      const params = new URLSearchParams(search);
      const id = params.get("id");
      const action = params.get("action");
      const tab = params.get("tab");

      if (path.startsWith("/beneficiary")) {
        setActiveNav("Beneficiary");
        if (id) {
          let found = null;
          try {
            const stored = JSON.parse(localStorage.getItem("crm_beneficiaries_registry") || "[]");
            found = stored.find((b) => b && (String(b.id) === String(id) || String(b.beneficiaryId) === String(id)));
          } catch (_) {}
          if (!found) {
            found = beneficiaries.find((b) => b && (String(b.id) === String(id) || String(b.beneficiaryId) === String(id)));
          }
          if (!found) {
            try {
              const reps = JSON.parse(localStorage.getItem("crm_inbound_triage_reports") || "[]");
              const mRep = reps.find((r) => r && (String(r.beneficiaryId) === String(id) || String(r.id) === String(id)));
              if (mRep) {
                found = {
                  id,
                  beneficiaryId: id,
                  fullName: mRep.name || "Beneficiary",
                  phoneNumber: mRep.details?.phone || mRep.phone || "",
                  district: mRep.details?.district || mRep.district || "",
                  state: mRep.details?.state || "Assam",
                };
              }
            } catch (_) {}
          }
          if (!found) {
            try {
              const calls = JSON.parse(localStorage.getItem("crm_all_call_logs") || "[]");
              const mCall = calls.find((c) => c && (String(c.beneficiaryId) === String(id) || String(c.id) === String(id)));
              if (mCall) {
                found = {
                  id,
                  beneficiaryId: id,
                  fullName: mCall.fullName || "Beneficiary",
                  phoneNumber: mCall.phoneNumber || mCall.cleanPhone || "",
                  district: mCall.district || "",
                  state: "Assam",
                };
              }
            } catch (_) {}
          }
          if (found) {
            populateBeneficiaryForm(found);
            document.title = `${found.fullName} - ${found.id}`;
          } else {
            const { calls: bCalls, surveys: bSurveys } = loadBeneficiaryHistory(id, "");
            setCallHistory(bCalls || []);
            setSurveyHistory(bSurveys || []);
            setBeneficiaryData((prev) => ({ ...prev, beneficiaryId: id }));
            setBeneficiaryViewMode("form");
            document.title = `Beneficiary - ${id}`;
          }
        } else if (action === "new") {
          setBeneficiaryViewMode("form");
          document.title = "Add Beneficiary";
        } else {
          setBeneficiaryViewMode("list");
          document.title = "Beneficiary";
        }
      } else if (path.startsWith("/crm")) {
        if (tab === "campaigns") {
          setActiveNav("Campaigns");
          document.title = "Crm Campaign";
        } else if (tab === "master") {
          setActiveNav("Master");
          document.title = "Master";
        } else if (tab === "reports") {
          setActiveNav("Reports");
          const reportParam = params.get("report");
          if (reportParam === "call-log") {
            setSelectedReport("Call Log Report");
            document.title = "Call Log Report";
          } else if (reportParam === "triage") {
            setSelectedReport("Inbound Triage Report");
            document.title = "Inbound Triage Report";
          } else {
            setSelectedReport(null);
            document.title = "reports";
          }
        } else if (tab === "task-list") {
          setActiveNav("Task List");
          document.title = "To Do";
        } else {
          setActiveNav("CRM Dashboard");
          document.title = "CRM Dashboard";
        }
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [beneficiaries, loadBeneficiaryHistory]);


  const initialIdLoadedRef = useRef(false);
  useEffect(() => {
    if (initialBeneficiaryId && !initialIdLoadedRef.current) {
      initialIdLoadedRef.current = true;
      const targetQuery = String(initialBeneficiaryId).trim();
      const cleanDigits = targetQuery.replace(/\D/g, "").slice(-10);
      let found = null;

      // 1. Check registry in localStorage
      if (typeof window !== "undefined") {
        try {
          const stored = JSON.parse(localStorage.getItem("crm_beneficiaries_registry") || "[]");
          found = stored.find((b) => {
            if (!b) return false;
            const bId = String(b.id || b.beneficiaryId || "");
            const bPhone = (b.cleanPhone || b.phoneNumber || "").toString().replace(/\D/g, "").slice(-10);
            return bId === targetQuery || (cleanDigits && bPhone === cleanDigits);
          });
        } catch (_) {}
      }

      // 2. Check phone specific localStorage record
      if (!found && cleanDigits && typeof window !== "undefined") {
        try {
          const rawPhoneRec = localStorage.getItem(`crm_beneficiary_phone_${cleanDigits}`);
          if (rawPhoneRec) {
            found = JSON.parse(rawPhoneRec);
          }
        } catch (_) {}
      }

      // 3. Check beneficiaries state
      if (!found) {
        found = beneficiaries.find((b) => {
          if (!b) return false;
          const bId = String(b.id || b.beneficiaryId || "");
          const bPhone = (b.cleanPhone || b.phoneNumber || "").toString().replace(/\D/g, "").slice(-10);
          return bId === targetQuery || (cleanDigits && bPhone === cleanDigits);
        });
      }

      // 4. Check inbound triage reports
      if (!found && typeof window !== "undefined") {
        try {
          const reps = JSON.parse(localStorage.getItem("crm_inbound_triage_reports") || "[]");
          const mRep = reps.find((r) => {
            if (!r) return false;
            const rId = String(r.beneficiaryId || r.id || "");
            const rPhone = (r.details?.phone || r.phone || r.cleanPhone || "").toString().replace(/\D/g, "").slice(-10);
            return rId === targetQuery || (cleanDigits && rPhone === cleanDigits);
          });
          if (mRep) {
            found = {
              id: mRep.beneficiaryId || targetQuery,
              beneficiaryId: mRep.beneficiaryId || targetQuery,
              fullName: mRep.name || "Beneficiary",
              phoneNumber: mRep.details?.phone || mRep.phone || (cleanDigits ? `+91-${cleanDigits}` : ""),
              cleanPhone: cleanDigits || (mRep.details?.phone || mRep.phone || "").replace(/\D/g, "").slice(-10),
              district: mRep.details?.district || mRep.district || "",
              state: mRep.details?.state || "Assam",
              center: mRep.details?.center || "Asam Center 1",
            };
          }
        } catch (_) {}
      }

      // 5. Check call logs
      if (!found && typeof window !== "undefined") {
        try {
          const calls = JSON.parse(localStorage.getItem("crm_all_call_logs") || "[]");
          const mCall = calls.find((c) => {
            if (!c) return false;
            const cId = String(c.beneficiaryId || c.id || "");
            const cPhone = (c.phoneNumber || c.cleanPhone || "").toString().replace(/\D/g, "").slice(-10);
            return cId === targetQuery || (cleanDigits && cPhone === cleanDigits);
          });
          if (mCall) {
            found = {
              id: mCall.beneficiaryId || targetQuery,
              beneficiaryId: mCall.beneficiaryId || targetQuery,
              fullName: mCall.fullName || "Beneficiary",
              phoneNumber: mCall.phoneNumber || mCall.cleanPhone || (cleanDigits ? `+91-${cleanDigits}` : ""),
              cleanPhone: cleanDigits || (mCall.cleanPhone || mCall.phoneNumber || "").replace(/\D/g, "").slice(-10),
              district: mCall.district || "",
              state: "Assam",
              center: "Asam Center 1",
            };
          }
        } catch (_) {}
      }

      if (found) {
        handleOpenBeneficiaryDetail(found);
      } else {
        const { calls: bCalls, surveys: bSurveys } = loadBeneficiaryHistory(targetQuery, cleanDigits);
        setCallHistory(bCalls || []);
        setSurveyHistory(bSurveys || []);
        setBeneficiaryData((prev) => ({
          ...prev,
          beneficiaryId: targetQuery,
          phoneNumber: cleanDigits ? `+91-${cleanDigits}` : prev.phoneNumber,
        }));
        setBeneficiaryViewMode("form");
      }
    }
  }, [initialBeneficiaryId, beneficiaries, loadBeneficiaryHistory]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
    }, 450);
  };

  const renderStatusDot = (status) => {
    switch (status) {
      case "Closed":
        return <span className="h-2 w-2 rounded-full bg-[#16a34a] inline-block shrink-0" />;
      case "Open":
        return <span className="h-2 w-2 rounded-full bg-[#2563eb] inline-block shrink-0" />;
      case "Cancelled":
        return <span className="h-2 w-2 rounded-full bg-[#94a3b8] inline-block shrink-0" />;
      case "Delayed":
      default:
        return <span className="h-2 w-2 rounded-full bg-[#ea580c] inline-block shrink-0" />;
    }
  };

  if (!crmLoggedIn) {
    return (
      <div
        className="fixed inset-0 w-full h-full bg-cover bg-center flex items-center justify-end pr-6 sm:pr-14 md:pr-20 lg:pr-32 select-none z-50 overflow-y-auto"
        style={{
          backgroundImage: "url('/brms-login-bg.jpg')",
          backgroundColor: "#1a4469",
        }}
      >
        <div className="bg-white rounded-2xl shadow-2xl p-7 sm:p-9 w-full max-w-[390px] border border-white/60 animate-in fade-in zoom-in-95 duration-150 mx-4 sm:mx-0 my-auto">
          <div className="flex flex-col items-center mb-6">
            <img
              src="/piramal-crm-logo.png"
              alt="Piramal Foundation"
              className="h-10 object-contain mb-2"
            />
            <h2 className="text-[20px] font-bold text-[#1a4469] tracking-tight">
              Piramal ESIC
            </h2>
          </div>

          <form onSubmit={handleCrmLoginSubmit} className="space-y-4">
            {crmLoginError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded text-rose-700 text-[12px] leading-tight flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-500" />
                <span>{crmLoginError}</span>
              </div>
            )}

            <div>
              <div className="relative">
                <Mail className="h-4 w-4 text-[#74808b] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={crmLoginId}
                  onChange={(e) => setCrmLoginId(e.target.value)}
                  placeholder="jane@example.com"
                  className="w-full bg-[#f3f4f6] hover:bg-[#eef1f4] focus:bg-white border border-transparent focus:border-[#1a4469] rounded-lg h-[42px] pl-10 pr-3.5 text-[13px] text-[#1f272e] placeholder-[#74808b] outline-none transition"
                  autoFocus
                />
              </div>
              {/* Quick account selector chips */}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {["Agent 1", "Agent 2", "Agent 3", "Admin 1", "Admin 2"].map((acc) => (
                  <button
                    key={acc}
                    type="button"
                    onClick={() => setCrmLoginId(acc)}
                    className={`px-2 py-0.5 rounded text-[10.5px] font-medium border transition cursor-pointer ${
                      crmLoginId === acc
                        ? "bg-[#1a4469] text-white border-[#1a4469]"
                        : "bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200"
                    }`}
                  >
                    {acc}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="relative">
                <Lock className="h-4 w-4 text-[#74808b] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type={crmShowPassword ? "text" : "password"}
                  value={crmLoginPassword}
                  onChange={(e) => setCrmLoginPassword(e.target.value)}
                  placeholder="•••••"
                  className="w-full bg-[#f3f4f6] hover:bg-[#eef1f4] focus:bg-white border border-transparent focus:border-[#1a4469] rounded-lg h-[42px] pl-10 pr-14 text-[13px] text-[#1f272e] placeholder-[#74808b] outline-none transition"
                />
                <button
                  type="button"
                  onClick={() => setCrmShowPassword(!crmShowPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[12px] font-semibold text-[#74808b] hover:text-[#1a4469] cursor-pointer select-none"
                >
                  {crmShowPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <div className="flex justify-end pt-0.5">
              <button
                type="button"
                onClick={() => toast.info("Demo password is pass123")}
                className="text-[12px] text-[#74808b] hover:text-[#1a4469] transition cursor-pointer"
              >
                Forgot Password?
              </button>
            </div>

            <button
              type="submit"
              className="w-full bg-[#1a4469] hover:bg-[#13334f] active:scale-[0.99] text-white font-medium text-[14px] h-[40px] rounded-lg transition shadow-sm cursor-pointer flex items-center justify-center tracking-wide"
            >
              Login
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full h-screen overflow-hidden bg-white font-sans text-[#1f272e] select-text text-[13px]">
      {/* ================= 1. LEFT SIDEBAR (Starts at y=0, h-screen, Never moves on scroll) ================= */}
      <aside
        className={`flex flex-col bg-[#fbfcfc] border-r border-[#e2e8f0] h-screen shrink-0 transition-all duration-150 z-30 select-none ${
          sidebarCollapsed ? "w-[60px]" : "w-[210px]"
        }`}
      >
        {/* Piramal Foundation Header with Real Official Logo */}
        <div className="p-3.5 flex items-center justify-between border-b border-[#f1f3f5] cursor-pointer hover:bg-[#f4f6f8] transition">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <img
              src="/piramal-foundation-logo.png"
              alt="Piramal Foundation"
              className="h-7 w-7 object-contain shrink-0"
            />
            {!sidebarCollapsed && (
              <div className="leading-tight">
                <div className="text-[13px] font-bold text-[#1f272e]">Piramal</div>
                <div className="text-[11px] text-[#556370]">Foundation</div>
              </div>
            )}
          </div>
          {!sidebarCollapsed && <ChevronDown className="h-3.5 w-3.5 text-[#7b8997]" />}
        </div>

        {/* Sidebar Menu Items */}
        <nav className="p-2 space-y-0.5 flex-1 text-[13px]">
          {/* 1. CRM Dashboard */}
          <div
            onClick={() => {
              setActiveNav("CRM Dashboard");
              if (typeof window !== "undefined") {
                document.title = "CRM Dashboard";
                try {
                  window.history.pushState({ page: "crm" }, '', '/crm');
                } catch (_) {}
              }
            }}
            className={`flex items-center gap-2.5 px-3 py-2 rounded cursor-pointer transition ${
              activeNav === "CRM Dashboard"
                ? "bg-[#e8edf2] text-[#1f272e] font-semibold shadow-xs"
                : "text-[#4b5866] hover:bg-[#f0f2f5] hover:text-[#1f272e]"
            }`}
          >
            <LayoutGrid className="h-4 w-4 text-[#697887] shrink-0" />
            {!sidebarCollapsed && <span>CRM Dashboard</span>}
          </div>

          {/* 2. Beneficiary (matching media_1791477741300.png and list) */}
          <div
            onClick={() => {
              setActiveNav("Beneficiary");
              setBeneficiaryViewMode("list");
              if (typeof window !== "undefined") {
                document.title = "Beneficiary";
                try {
                  window.history.pushState({ page: "beneficiary-list" }, '', '/beneficiary');
                } catch (err) {}
              }
            }}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-md cursor-pointer transition ${
              activeNav === "Beneficiary"
                ? "bg-[#e8edf2] text-[#1f272e] font-semibold shadow-xs"
                : "text-[#4b5866] hover:bg-[#f0f2f5] hover:text-[#1f272e]"
            }`}
          >
            <UserCheck className="h-4 w-4 text-[#1f272e] shrink-0" />
            {!sidebarCollapsed && <span>Beneficiary</span>}
          </div>

          {/* 3. Campaigns */}
          <div
            onClick={() => {
              setActiveNav("Campaigns");
              if (typeof window !== "undefined") {
                document.title = "Crm Campaign";
                try {
                  window.history.pushState({ page: "crm", tab: "campaigns" }, '', '/crm?tab=campaigns');
                } catch (_) {}
              }
            }}
            className={`flex items-center gap-2.5 px-3 py-2 rounded cursor-pointer transition ${
              activeNav === "Campaigns"
                ? "bg-[#e8edf2] text-[#1f272e] font-semibold shadow-xs"
                : "text-[#4b5866] hover:bg-[#f0f2f5] hover:text-[#1f272e]"
            }`}
          >
            <Calendar className="h-4 w-4 text-[#697887] shrink-0" />
            {!sidebarCollapsed && <span>Campaigns</span>}
          </div>

          {/* 4. Master */}
          <div
            onClick={() => {
              setActiveNav("Master");
              if (typeof window !== "undefined") {
                document.title = "Master";
                try {
                  window.history.pushState({ page: "crm", tab: "master" }, '', '/crm?tab=master');
                } catch (_) {}
              }
            }}
            className={`flex items-center gap-2.5 px-3 py-2 rounded cursor-pointer transition ${
              activeNav === "Master"
                ? "bg-[#e8edf2] text-[#1f272e] font-semibold shadow-xs"
                : "text-[#4b5866] hover:bg-[#f0f2f5] hover:text-[#1f272e]"
            }`}
          >
            <Sliders className="h-4 w-4 text-[#697887] shrink-0" />
            {!sidebarCollapsed && <span>Master</span>}
          </div>

          {/* 5. Reports */}
          <div
            onClick={() => {
              setActiveNav("Reports");
              setSelectedReport(null);
              if (typeof window !== "undefined") {
                document.title = "reports";
                try {
                  window.history.pushState({ page: "crm", tab: "reports" }, '', '/crm?tab=reports');
                } catch (_) {}
              }
            }}
            className={`flex items-center gap-2.5 px-3 py-2 rounded cursor-pointer transition ${
              activeNav === "Reports"
                ? "bg-[#e8edf2] text-[#1f272e] font-semibold shadow-xs"
                : "text-[#4b5866] hover:bg-[#f0f2f5] hover:text-[#1f272e]"
            }`}
          >
            <FileText className="h-4 w-4 text-[#697887] shrink-0" />
            {!sidebarCollapsed && <span>Reports</span>}
          </div>

          {/* 6. Task List (ToDo) */}
          <div
            onClick={() => {
              setActiveNav("Task List");
              if (typeof window !== "undefined") {
                document.title = "To Do";
                try {
                  window.history.pushState({ page: "crm", tab: "task-list" }, '', '/crm?tab=task-list');
                } catch (_) {}
              }
            }}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-md cursor-pointer transition ${
              activeNav === "Task List"
                ? "bg-[#e8edf2] text-[#1f272e] font-semibold shadow-xs"
                : "text-[#4b5866] hover:bg-[#f0f2f5] hover:text-[#1f272e]"
            }`}
          >
            <Phone className="h-4 w-4 text-[#1f272e] shrink-0" />
            {!sidebarCollapsed && <span>Task List</span>}
          </div>
        </nav>

        {/* Collapse Button at Bottom */}
        <div className="p-2 border-t border-[#f1f3f5]">
          <button
            type="button"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="flex items-center gap-2 px-3 py-1.5 text-[12px] text-[#697887] hover:text-[#1f272e] hover:bg-[#f0f2f5] rounded w-full transition cursor-pointer"
          >
            {sidebarCollapsed ? (
              <ArrowRightToLine className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <>
                <ArrowLeftToLine className="h-3.5 w-3.5 shrink-0" />
                <span>Collapse</span>
              </>
            )}
          </button>
        </div>
      </aside>

      {/* ================= 2. RIGHT COLUMN (Blue Header + Scrollable Views) ================= */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden min-w-0">
        {/* ================= TOP BLUE APP BAR (Starts to the right of sidebar, Never moves on scroll) ================= */}
        <header className="h-[44px] bg-[#1a385c] px-4 flex items-center justify-between text-white shrink-0 z-20">
          {/* Left Title in Blue Header */}
          <div className="flex items-center gap-2 text-[13px] font-medium tracking-wide text-white">
            <span>
              {activeNav === "Beneficiary" ? (
                beneficiaryViewMode === "list" ? (
                  <span className="flex items-center gap-1.5 font-medium">
                    <span
                      onClick={() => {
                        setActiveNav("CRM Dashboard");
                        if (typeof window !== "undefined") {
                          document.title = "CRM Dashboard";
                          try {
                            window.history.pushState({ page: "crm" }, '', '/crm');
                          } catch (_) {}
                        }
                      }}
                      className="cursor-pointer hover:underline opacity-90"
                    >
                      CRM Dashboard
                    </span>
                    <span className="opacity-60 font-mono">&gt;</span>
                    <span className="font-bold tracking-normal">Beneficiary</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 font-medium">
                    <span
                      onClick={() => {
                        setActiveNav("CRM Dashboard");
                        if (typeof window !== "undefined") {
                          document.title = "CRM Dashboard";
                          try {
                            window.history.pushState({ page: "crm" }, '', '/crm');
                          } catch (_) {}
                        }
                      }}
                      className="cursor-pointer hover:underline opacity-90"
                    >
                      CRM Dashboard
                    </span>
                    <span className="opacity-60 font-mono">&gt;</span>
                    <span
                      onClick={() => {
                        setBeneficiaryViewMode("list");
                        if (typeof window !== "undefined") {
                          document.title = "Beneficiary";
                          try {
                            window.history.pushState({ page: "beneficiary-list" }, '', '/beneficiary');
                          } catch (err) {}
                        }
                      }}
                      className="cursor-pointer hover:underline opacity-90"
                    >
                      Beneficiary
                    </span>
                    <span className="opacity-60 font-mono">&gt;</span>
                    <span className="font-bold tracking-normal" suppressHydrationWarning>
                      {beneficiaryData.beneficiaryId}
                    </span>
                  </span>
                )
              ) : activeNav === "Campaigns" ? (
                "Crm Campaign"
              ) : activeNav === "Master" ? (
                "Master"
              ) : activeNav === "Reports" ? (
                "reports"
              ) : activeNav === "Task List" ? (
                "To Do"
              ) : (
                ""
              )}
            </span>
          </div>

          {/* Right Search Bar, Bell, and Profile */}
          <div className="flex items-center gap-2.5">
            {/* Back to Triage Button (Highlighted in EKMS Logo Green) */}
            <a
              href="/"
              className="flex items-center gap-1.5 px-3 py-1 bg-[#059669] hover:bg-[#047857] text-white text-[12px] font-bold rounded shadow-md border border-emerald-400/50 hover:shadow-lg transition-all duration-150 cursor-pointer shrink-0 active:scale-95"
              title="Return to EKMS Triage Console"
            >
              <ArrowLeftToLine className="h-3.5 w-3.5 stroke-[2.5]" />
              <span>Back to Triage</span>
            </a>

            {/* Global Search Bar */}
            <div className="relative w-[300px] sm:w-[340px] md:w-[380px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#8b9aa8]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search or type a command (Ctrl + K)"
                className="w-full h-[28px] pl-8 pr-3 bg-white text-[#1f272e] placeholder-[#7d8c9b] text-[12px] rounded outline-none shadow-inner"
              />
            </div>

            {/* Bell Icon */}
            <button
              type="button"
              className="text-white/80 hover:text-white p-1 rounded transition cursor-pointer"
              title="Notifications"
            >
              <Bell className="h-4 w-4" />
            </button>

            {/* User Profile Avatar with Frappe Dropdown */}
            <div className="relative" ref={userMenuRef}>
              <div
                onClick={() => setUserMenuOpen((prev) => !prev)}
                className="w-7 h-7 rounded-full bg-[#009688] text-white flex items-center justify-center text-[11px] font-bold cursor-pointer hover:ring-2 hover:ring-white/40 transition select-none shrink-0 shadow-xs tracking-tight"
                title={`${activeAgentId} (Active Operator)`}
              >
                {(() => {
                  const clean = (activeAgentId || "").trim();
                  const lower = clean.toLowerCase();
                  const numMatch = clean.match(/\d+/);
                  const num = numMatch ? numMatch[0] : "1";
                  if (lower.startsWith("admin")) {
                    return `AD${num}`;
                  }
                  return `A${num}`;
                })()}
              </div>

              {/* Profile Dropdown Menu */}
              {userMenuOpen && (
                <div className="absolute right-0 top-8 w-52 bg-white text-[#1f272e] rounded shadow-xl border border-[#dce2e8] py-1 text-[13px] z-50">
                  <div className="px-3.5 py-2 border-b border-[#f1f3f5] bg-[#f8f9fa]">
                    <div className="font-semibold text-[#1e293b] text-[12.5px]">{activeAgentId}</div>
                    <div className="text-[11px] text-[#64748b]">Active Account</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setUserMenuOpen(false)}
                    className="w-full text-left px-3.5 py-1.5 hover:bg-[#f3f5f7] cursor-pointer transition"
                  >
                    User Settings
                  </button>
                  <button
                    type="button"
                    onClick={() => setUserMenuOpen(false)}
                    className="w-full text-left px-3.5 py-1.5 hover:bg-[#f3f5f7] cursor-pointer transition"
                  >
                    Workspace Settings
                  </button>
                  <button
                    type="button"
                    onClick={() => setUserMenuOpen(false)}
                    className="w-full text-left px-3.5 py-1.5 hover:bg-[#f3f5f7] cursor-pointer transition"
                  >
                    Session Defaults
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleRefresh();
                      setUserMenuOpen(false);
                    }}
                    className="w-full text-left px-3.5 py-1.5 hover:bg-[#f3f5f7] cursor-pointer transition"
                  >
                    Reload
                  </button>
                  <button
                    type="button"
                    onClick={() => setUserMenuOpen(false)}
                    className="w-full text-left px-3.5 py-1.5 hover:bg-[#f3f5f7] cursor-pointer transition"
                  >
                    View Website
                  </button>
                  <button
                    type="button"
                    onClick={() => setUserMenuOpen(false)}
                    className="w-full text-left px-3.5 py-1.5 hover:bg-[#f3f5f7] cursor-pointer transition"
                  >
                    Apps
                  </button>
                  <button
                    type="button"
                    onClick={() => setUserMenuOpen(false)}
                    className="w-full text-left px-3.5 py-1.5 hover:bg-[#f3f5f7] cursor-pointer transition"
                  >
                    Toggle Full Width
                  </button>
                  <button
                    type="button"
                    onClick={() => setUserMenuOpen(false)}
                    className="w-full text-left px-3.5 py-1.5 hover:bg-[#f3f5f7] cursor-pointer transition"
                  >
                    Toggle Theme
                  </button>
                  <div className="h-px bg-[#e9ecef] my-1" />
                  <a
                    href="/"
                    className="flex items-center justify-between px-3.5 py-1.5 hover:bg-[#f3f5f7] text-[#1a67cc] font-medium transition cursor-pointer"
                  >
                    <span>Switch to EKMS Triage</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setUserMenuOpen(false);
                      handleLogout();
                    }}
                    className="w-full text-left px-3.5 py-1.5 hover:bg-[#f3f5f7] text-[#c0392b] font-medium cursor-pointer transition"
                  >
                    Log out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* ================= 3. SCROLLABLE WORKSPACE (Only this area scrolls!) ================= */}
        <div className="flex-1 flex overflow-hidden min-h-0 bg-[#f5f7f9]">

        {/* ================= VIEW 1: CRM DASHBOARD (media_1791433577114.png) ================= */}
        {activeNav === "CRM Dashboard" && (
          <main className="flex-1 flex flex-col bg-[#f5f7f9] overflow-y-auto p-5">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <LayoutGrid className="h-4 w-4 text-[#1f272e]" />
                <h1 className="text-[18px] font-bold text-[#1f272e]">CRM Dashboard</h1>
              </div>
            </div>

            <div className="flex flex-col gap-4 max-w-[1300px]">
              {/* Row 1: TOTAL BENEFICIARIES (Click to open Beneficiary list view) */}
              <div className="flex justify-start">
                <div
                  onClick={() => {
                    setActiveNav("Beneficiary");
                    setBeneficiaryViewMode("list");
                    if (typeof window !== "undefined") {
                      document.title = "Beneficiary";
                      try {
                        window.history.pushState({ page: "beneficiary-list" }, '', '/beneficiary');
                      } catch (_) {}
                    }
                  }}
                  className="bg-white rounded-lg border border-[#e2e8f0] hover:border-[#2563eb] hover:shadow-md p-4 w-full md:w-[340px] shadow-2xs cursor-pointer transition active:scale-[0.99] group select-none"
                  title="Click to view all Beneficiaries on separate page"
                >
                  <div className="flex items-center justify-between text-[#556370] text-[11px] font-bold tracking-wider mb-2">
                    <span className="group-hover:text-[#2563eb] transition-colors">TOTAL BENEFICIARIES</span>
                    <MoreHorizontal className="h-3.5 w-3.5 cursor-pointer text-[#7b8997]" />
                  </div>
                  <div className="text-[32px] font-bold text-[#1f272e] tracking-tight group-hover:text-[#2563eb] transition-colors">
                    {beneficiaries.length}
                  </div>
                </div>
              </div>

              {/* Row 2: Grid containing Chart and ToDo */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* Beneficiaries by Campaign Bar Chart */}
                <div className="lg:col-span-7 bg-white rounded-lg border border-[#e2e8f0] p-4 shadow-2xs">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[13px] font-semibold text-[#1f272e]">
                      Beneficiaries by campaign
                    </span>
                    <div className="flex items-center gap-2 text-[#7b8997]">
                      <Filter className="h-3.5 w-3.5 cursor-pointer hover:text-[#1f272e]" />
                      <MoreHorizontal className="h-3.5 w-3.5 cursor-pointer hover:text-[#1f272e]" />
                    </div>
                  </div>

                  {/* Chart Graphic Area */}
                  <div className="h-[230px] flex flex-col justify-between pt-2">
                    <div className="h-[175px] w-full flex items-end gap-1 pb-2 border-b border-[#edf0f2] relative">
                      {/* Y-axis guidelines */}
                      <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-40 text-[10px] text-[#8b9aa8]">
                        <div className="border-b border-dashed border-[#dce2e8] w-full flex items-center justify-end pr-1">10 K</div>
                        <div className="border-b border-dashed border-[#dce2e8] w-full flex items-center justify-end pr-1">8 K</div>
                        <div className="border-b border-dashed border-[#dce2e8] w-full flex items-center justify-end pr-1">6 K</div>
                        <div className="border-b border-dashed border-[#dce2e8] w-full flex items-center justify-end pr-1">4 K</div>
                        <div className="border-b border-dashed border-[#dce2e8] w-full flex items-center justify-end pr-1">2 K</div>
                        <div className="flex items-center justify-end pr-1">0</div>
                      </div>

                      {/* Bar columns with explicit heights */}
                      <div className="w-full h-full flex items-end justify-between gap-1 z-10 pl-2 pr-10">
                        {CHART_BARS.map((bar, idx) => (
                          <div
                            key={idx}
                            className="flex-1 h-full flex flex-col justify-end items-center group relative cursor-pointer"
                          >
                            {/* Hover tooltip */}
                            <span className="text-[9px] text-[#556370] font-semibold opacity-0 group-hover:opacity-100 transition absolute -top-5 bg-white px-1 rounded shadow-xs border border-[#e2e8f0] z-20 whitespace-nowrap pointer-events-none">
                              {bar.val}
                            </span>
                            {/* Bar fill (exact pink/rose color #ea6c99 from screenshot) */}
                            <div
                              style={{ height: `${bar.heightPx}px` }}
                              className="w-full bg-[#ea6c99] hover:bg-[#d84879] rounded-t-[2px] transition-all"
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* X-axis labels */}
                    <div className="flex items-center justify-between text-[10px] text-[#7b8997] pt-2 pl-2 pr-10 truncate">
                      {CHART_BARS.map((bar, idx) => (
                        <div key={idx} className="flex-1 text-center truncate px-0.5">
                          {bar.label}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* ToDo Card */}
                <div className="lg:col-span-5 bg-white rounded-lg border border-[#e2e8f0] p-4 flex flex-col justify-between shadow-2xs">
                  <div>
                    <h3 className="text-[13px] font-semibold text-[#1f272e] mb-8">ToDo</h3>
                    <div className="h-[120px] flex items-center justify-center text-[#7b8997] text-[13px]">
                      No Data...
                    </div>
                  </div>

                  {/* View List Button (links directly to Task List!) */}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveNav("Task List");
                      if (typeof window !== "undefined") {
                        document.title = "To Do";
                        try {
                          window.history.pushState({ page: "crm", tab: "task-list" }, '', '/crm?tab=task-list');
                        } catch (_) {}
                      }
                    }}
                    className="w-full py-2 bg-[#f4f6f8] hover:bg-[#eaedf2] text-[#333e48] rounded text-[12px] font-medium transition cursor-pointer"
                  >
                    View List
                  </button>
                </div>
              </div>

              {/* Row 3: Reports Card */}
              <div className="bg-white rounded-lg border border-[#e2e8f0] p-4 shadow-2xs w-full md:w-[380px]">
                <h3 className="text-[13px] font-semibold text-[#1f272e] mb-3">Reports</h3>
                <div className="space-y-2 text-[12px]">
                  {[
                    "Inbound Triage Report",
                    "Call Log Report",
                    "Campaign Report",
                    "Agent Task Count Report",
                    "Follow-up Report",
                  ].map((rpt) => (
                    <div
                      key={rpt}
                      onClick={() => {
                        setActiveNav("Reports");
                        if (rpt === "Inbound Triage Report") {
                          setSelectedReport("Inbound Triage Report");
                          setTriageReportsList(loadAllTriageReports());
                        } else if (rpt === "Call Log Report") {
                          setSelectedReport("Call Log Report");
                          setCallLogsList(loadAllCallLogs());
                        } else {
                          setSelectedReport(null);
                        }
                        if (typeof window !== "undefined") {
                          document.title = rpt === "Call Log Report" ? "Call Log Report" : "reports";
                          try {
                            const reportParam = rpt === "Call Log Report" ? "call-log" : (rpt === "Inbound Triage Report" ? "triage" : "");
                            window.history.pushState(
                              { page: "crm", tab: "reports", report: rpt },
                              '',
                              reportParam ? `/crm?tab=reports&report=${reportParam}` : '/crm?tab=reports'
                            );
                          } catch (_) {}
                        }
                      }}
                      className="flex items-center justify-between text-[#333e48] hover:text-[#1a385c] hover:underline cursor-pointer transition py-0.5"
                    >
                      <span className={rpt === "Inbound Triage Report" || rpt === "Call Log Report" ? "font-semibold text-[#1a67cc]" : ""}>{rpt}</span>
                      <ArrowUpRight className="h-3.5 w-3.5 text-[#7b8997]" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </main>
        )}

        {/* ================= VIEW 2: CAMPAIGNS (media_1791433602473.png) ================= */}
        {activeNav === "Campaigns" && (
          <main className="flex-1 flex flex-col bg-white overflow-x-auto overflow-y-auto">
            {/* Top Toolbar */}
            <div className="px-5 pt-3.5 pb-2.5 flex items-center justify-between shrink-0">
              <h1 className="text-[20px] font-bold text-[#1f272e] tracking-tight">Crm Campaign</h1>

              {/* Action buttons */}
              <div className="flex items-center gap-2 text-[12px]">
                <button
                  type="button"
                  className="flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-[#f8f9fa] border border-[#d1d7de] rounded text-[#333e48] font-normal transition cursor-pointer"
                >
                  <div className="flex flex-col gap-0.5">
                    <div className="w-3 h-[2px] bg-[#333e48]" />
                    <div className="w-3 h-[2px] bg-[#333e48]" />
                    <div className="w-3 h-[2px] bg-[#333e48]" />
                  </div>
                  <span>List View</span>
                  <ChevronsUpDown className="h-3 w-3 text-[#697887]" />
                </button>

                <button
                  type="button"
                  onClick={handleRefresh}
                  className="p-1.5 bg-white hover:bg-[#f8f9fa] border border-[#d1d7de] rounded text-[#333e48] transition cursor-pointer"
                  title="Refresh"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
                </button>

                <button
                  type="button"
                  className="p-1.5 bg-white hover:bg-[#f8f9fa] border border-[#d1d7de] rounded text-[#333e48] transition cursor-pointer"
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </button>

                {/* Primary Add Button (Frappe blue) */}
                <button
                  type="button"
                  className="flex items-center gap-1 px-3 py-1 bg-[#1a67cc] hover:bg-[#165bb5] text-white rounded font-medium text-[12px] shadow-2xs transition cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
                  <span>Add Crm Campaign</span>
                </button>
              </div>
            </div>

            {/* Filter Pills Bar */}
            <div className="px-5 py-2 flex flex-wrap items-center gap-2 border-b border-[#f1f3f5] shrink-0 text-[12px]">
              <input
                type="text"
                placeholder="ID"
                className="h-[28px] w-[90px] px-2.5 bg-[#f6f7f8] border border-[#dce2e8] rounded text-[#1f272e] placeholder-[#7d8c9b] outline-none"
              />
              <input
                type="text"
                placeholder="Campaign Name"
                value={campaignSearch}
                onChange={(e) => setCampaignSearch(e.target.value)}
                className="h-[28px] w-[130px] px-2.5 bg-[#f6f7f8] border border-[#dce2e8] rounded text-[#1f272e] placeholder-[#7d8c9b] outline-none"
              />
              <button
                type="button"
                onClick={() => setCampaignSearch("")}
                className="flex items-center gap-1.5 h-[28px] px-2.5 bg-white border border-[#dce2e8] rounded text-[#4b5866] hover:bg-[#f6f7f8] transition cursor-pointer"
              >
                <span>Filter</span>
                <X className="h-3 w-3 text-[#7b8997]" />
              </button>
              <button
                type="button"
                className="flex items-center gap-1.5 h-[28px] px-2.5 bg-white border border-[#dce2e8] rounded text-[#4b5866] hover:bg-[#f6f7f8] transition ml-auto cursor-pointer"
              >
                <span>Created On</span>
              </button>
            </div>

            {/* Campaigns Table */}
            <div className="flex-1 overflow-x-auto min-w-[840px]">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#f1f3f5] text-[#556370] text-[12px] font-normal h-[36px]">
                    <th className="w-10 pl-5 pr-2">
                      <button
                        type="button"
                        onClick={toggleSelectAllCampaigns}
                        className="w-4 h-4 rounded border border-[#c4cdd5] flex items-center justify-center cursor-pointer bg-white"
                      >
                        {selectedCampaignIds.size === filteredCampaigns.length && filteredCampaigns.length > 0 && (
                          <Check className="h-3 w-3 text-[#1f272e] stroke-[2.5]" />
                        )}
                      </button>
                    </th>
                    <th className="font-normal px-3">Campaign Name</th>
                    <th className="font-normal px-3 w-[90px]">Status</th>
                    <th className="font-normal px-3">Start Date</th>
                    <th className="font-normal px-3">Center</th>
                    <th className="font-normal px-3">End Date</th>
                    <th className="font-normal px-4 text-right">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#f1f3f5] text-[#556370] text-[11px]">
                        <span>{Math.min(filteredCampaigns.length, campaignPageSize)} of {campaigns.length}</span>
                        <Heart className="h-2.5 w-2.5 text-[#7b8997]" />
                      </span>
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-[#f7f8f9] text-[13px] text-[#1f272e]">
                  {filteredCampaigns.slice(0, campaignPageSize).map((cmp) => {
                    const isChecked = selectedCampaignIds.has(cmp.id);
                    return (
                      <tr
                        key={cmp.id}
                        onClick={() => toggleSelectCampaignRow(cmp.id)}
                        className={`h-[40px] hover:bg-[#fafbfc] transition cursor-pointer ${
                          isChecked ? "bg-[#f4f7fb]" : ""
                        }`}
                      >
                        <td className="w-10 pl-5 pr-2">
                          <button
                            type="button"
                            onClick={(e) => toggleSelectCampaignRow(cmp.id, e)}
                            className="w-4 h-4 rounded border border-[#d8e0e8] bg-white flex items-center justify-center cursor-pointer"
                          >
                            {isChecked && <Check className="h-3 w-3 text-[#1f272e] stroke-[2.5]" />}
                          </button>
                        </td>
                        <td className="px-3 font-normal text-[#1f272e] truncate max-w-[320px]">
                          <span className="hover:underline">{cmp.name}</span>
                        </td>
                        <td className="px-3">
                          <span
                            className={`text-[12px] font-medium ${
                              cmp.status === "Enabled" ? "text-emerald-700" : "text-[#7b8997]"
                            }`}
                          >
                            {cmp.status}
                          </span>
                        </td>
                        <td className="px-3 text-[#556370] text-[12px]">{cmp.startDate}</td>
                        <td className="px-3 text-[#556370] text-[12px]">{cmp.center}</td>
                        <td className="px-3 text-[#556370] text-[12px]">{cmp.endDate}</td>
                        <td className="px-4 text-right">
                          <div className="flex items-center justify-end gap-3 text-[12px] text-[#556370]">
                            <span>{cmp.timeAgo}</span>
                            <div className="flex items-center gap-0.5">
                              <MessageSquare className="h-3 w-3 stroke-[1.5]" />
                              <span className="text-[11px]">{cmp.comments}</span>
                            </div>
                            <span className="text-[#8b9aa8]">-</span>
                            <Heart className="h-3 w-3 text-[#7b8997]" />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="px-5 py-2.5 border-t border-[#f1f3f5] flex items-center justify-between text-[12px] text-[#697887] shrink-0">
              <div className="flex items-center gap-4">
                {[20, 100, 500, 2500].map((size) => (
                  <span
                    key={size}
                    onClick={() => setCampaignPageSize(size)}
                    className={`cursor-pointer ${campaignPageSize === size ? "text-[#1f272e] font-semibold" : ""}`}
                  >
                    {size}
                  </span>
                ))}
              </div>
              <button
                type="button"
                className="px-3 py-1 bg-white hover:bg-[#f8f9fa] border border-[#d1d7de] rounded text-[#333e48] transition cursor-pointer text-[12px]"
              >
                Load More
              </button>
            </div>
          </main>
        )}

        {/* ================= VIEW 3: MASTER (media_1791433611116.png) ================= */}
        {activeNav === "Master" && (
          <main className="flex-1 flex flex-col bg-[#f5f7f9] overflow-y-auto p-5">
            <div className="flex items-center gap-2 mb-4">
              <Sliders className="h-4 w-4 text-[#1f272e]" />
              <h1 className="text-[18px] font-bold text-[#1f272e]">Master</h1>
            </div>

            <div className="space-y-6 max-w-[1200px]">
              {/* Program Master */}
              <div>
                <h2 className="text-[13px] font-semibold text-[#556370] mb-3">Program Master</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: "CALL TYPE", val: 3 },
                    { label: "CATEGORY", val: 7 },
                    { label: "SUB-CATEGORY", val: 27 },
                    { label: "CENTER", val: 1 },
                  ].map((card) => (
                    <div
                      key={card.label}
                      className="bg-white rounded-lg border border-[#e2e8f0] p-4 shadow-2xs cursor-pointer hover:border-[#1a67cc] transition"
                    >
                      <div className="flex items-center justify-between text-[#7b8997] text-[11px] font-bold tracking-wider mb-2">
                        <span>{card.label}</span>
                        <MoreHorizontal className="h-3 w-3" />
                      </div>
                      <div className="text-[26px] font-bold text-[#1f272e]">{card.val}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Geography Master */}
              <div>
                <h2 className="text-[13px] font-semibold text-[#556370] mb-3">Geography Master</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: "STATE", val: 1 },
                    { label: "DISTRICT", val: 39 },
                    { label: "BLOCK", val: 67 },
                    { label: "VILLAGE", val: 2 },
                  ].map((card) => (
                    <div
                      key={card.label}
                      className="bg-white rounded-lg border border-[#e2e8f0] p-4 shadow-2xs cursor-pointer hover:border-[#1a67cc] transition"
                    >
                      <div className="flex items-center justify-between text-[#7b8997] text-[11px] font-bold tracking-wider mb-2">
                        <span>{card.label}</span>
                        <MoreHorizontal className="h-3 w-3" />
                      </div>
                      <div className="text-[26px] font-bold text-[#1f272e]">{card.val}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Campaign Master */}
              <div>
                <h2 className="text-[13px] font-semibold text-[#556370] mb-3">Campaign Master</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white rounded-lg border border-[#e2e8f0] p-4 shadow-2xs cursor-pointer hover:border-[#1a67cc] transition">
                    <div className="flex items-center justify-between text-[#7b8997] text-[11px] font-bold tracking-wider mb-2">
                      <span>SURVEY FORMS</span>
                      <MoreHorizontal className="h-3 w-3" />
                    </div>
                    <div className="text-[26px] font-bold text-[#1f272e]">13</div>
                  </div>
                </div>
              </div>
            </div>
          </main>
        )}

        {/* ================= VIEW 4: REPORTS ================= */}
        {activeNav === "Reports" && !selectedReport && (
          <main className="flex-1 flex flex-col bg-white overflow-y-auto p-6">
            <div className="flex items-center gap-2 mb-6">
              <FileText className="h-4 w-4 text-[#1f272e]" />
              <h1 className="text-[18px] font-bold text-[#1f272e]">Reports</h1>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5 max-w-[1200px]">
              {[
                { name: "Beneficiary Survey Pivot Report" },
                { name: "Agent Task Count Report" },
                { name: "Follow Up Report" },
                { name: "Call Log Report", isCallLog: true },
                { name: "Campaign Report" },
                { name: "Beneficiary Call Logs", isCallLog: true },
                { name: "Beneficiary Survey Report" },
                { name: "Delayed Follow Up Report" },
                { name: "Inbound Triage Report", isTriage: true },
              ].map((rpt) => (
                <div
                  key={rpt.name}
                  onClick={() => {
                    if (rpt.isTriage) {
                      setSelectedReport("Inbound Triage Report");
                      setTriageReportsList(loadAllTriageReports());
                    } else if (rpt.isCallLog) {
                      setSelectedReport("Call Log Report");
                      setCallLogsList(loadAllCallLogs());
                    } else {
                      toast.info(`${rpt.name} is scheduled for generation`);
                    }
                  }}
                  className="bg-white rounded-lg border border-[#e2e8f0] px-4 py-3.5 flex items-center justify-between hover:border-[#1a67cc] hover:shadow-xs transition cursor-pointer group"
                >
                  <span className="text-[13px] font-medium text-[#1f272e] group-hover:text-[#1a67cc] transition">
                    {rpt.name}
                  </span>
                  <ArrowUpRight className="h-3.5 w-3.5 text-[#7b8997] group-hover:text-[#1a67cc] shrink-0 transition" />
                </div>
              ))}
            </div>
          </main>
        )}

        {activeNav === "Reports" && selectedReport === "Inbound Triage Report" && (
          <main className="flex-1 flex flex-col bg-white overflow-hidden min-w-0">
            {/* Header: Title + Action Buttons (Export, Refresh, Bulk Delete) */}
            <div className="px-5 pt-4 pb-3 border-b border-[#f1f3f5] flex items-center justify-between shrink-0 bg-white">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedReport(null)}
                  className="text-[#556370] hover:text-[#1a67cc] p-1 rounded hover:bg-[#f4f5f7] transition cursor-pointer mr-1"
                  title="Back to Reports"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <h1 className="text-[18px] font-bold text-[#1f272e]">Inbound Triage Report</h1>
              </div>

              <div className="flex items-center gap-2">
                {selectedTriageReportIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteTriageModal({
                        isOpen: true,
                        type: "bulk",
                        id: null,
                        caseId: "",
                        beneficiaryId: null,
                        count: selectedTriageReportIds.length,
                      });
                    }}
                    className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-[12px] font-semibold transition cursor-pointer shadow-xs flex items-center gap-1.5 active:scale-95"
                    title="Bulk Delete Selected"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Delete ({selectedTriageReportIds.length})</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => toast.info("Exporting report data...")}
                  className="px-3 py-1 bg-white hover:bg-[#f8f9fa] border border-[#d1d7de] rounded text-[#333e48] transition cursor-pointer text-[12px] font-medium shadow-xs"
                >
                  Export
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const refreshed = loadAllTriageReports();
                    setTriageReportsList(refreshed);
                    toast.success("Reports refreshed");
                  }}
                  className="p-1.5 px-2 bg-white hover:bg-[#f8f9fa] border border-[#d1d7de] rounded text-[#556370] transition cursor-pointer shadow-xs"
                  title="Reload List"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Standard Filter Bar matching Beneficiary Page */}
            <div className="px-5 py-2.5 border-b border-[#f1f3f5] flex flex-wrap items-center justify-between gap-3 bg-white shrink-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <input
                  type="text"
                  value={triageReportFilterId}
                  onChange={(e) => setTriageReportFilterId(e.target.value)}
                  placeholder="ID"
                  className="w-[110px] h-[28px] px-2.5 bg-[#f4f5f7] border border-transparent focus:border-[#2563eb] focus:bg-white rounded text-[12px] text-[#1f272e] placeholder-[#8b9aa8] outline-none transition"
                />
                <input
                  type="text"
                  value={triageReportFilterCase}
                  onChange={(e) => setTriageReportFilterCase(e.target.value)}
                  placeholder="Case ID"
                  className="w-[110px] h-[28px] px-2.5 bg-[#f4f5f7] border border-transparent focus:border-[#2563eb] focus:bg-white rounded text-[12px] text-[#1f272e] placeholder-[#8b9aa8] outline-none transition"
                />
                <input
                  type="text"
                  value={triageReportFilterName}
                  onChange={(e) => setTriageReportFilterName(e.target.value)}
                  placeholder="Full Name"
                  className="w-[130px] h-[28px] px-2.5 bg-[#f4f5f7] border border-transparent focus:border-[#2563eb] focus:bg-white rounded text-[12px] text-[#1f272e] placeholder-[#8b9aa8] outline-none transition"
                />
                <select
                  value={triageReportFilterForm}
                  onChange={(e) => setTriageReportFilterForm(e.target.value)}
                  className="h-[28px] px-2 bg-[#f4f5f7] border border-transparent focus:border-[#2563eb] focus:bg-white rounded text-[12px] text-[#1f272e] outline-none transition cursor-pointer"
                >
                  <option value="">All Forms</option>
                  <option value="Inbound Triage">Inbound Triage Form</option>
                  <option value="ESIC Inbound">ESIC Inbound Form</option>
                </select>
                <input
                  type="text"
                  value={triageReportFilterAgent}
                  onChange={(e) => setTriageReportFilterAgent(e.target.value)}
                  placeholder="Agent / Admin"
                  className="w-[120px] h-[28px] px-2.5 bg-[#f4f5f7] border border-transparent focus:border-[#2563eb] focus:bg-white rounded text-[12px] text-[#1f272e] placeholder-[#8b9aa8] outline-none transition"
                />
              </div>

              <div className="flex items-center gap-3 text-[12px] text-[#8b9aa8]">
                <span>{filteredTriageReports.length} of {triageReportsList.length}</span>
              </div>
            </div>

            {/* Table Container */}
            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-left border-collapse text-[12.5px]">
                <thead>
                  <tr className="border-b border-[#e2e8f0] bg-[#fbfcfc] text-[#7b8997] font-normal sticky top-0 z-10">
                    <th className="py-2.5 px-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={
                          filteredTriageReports.length > 0 &&
                          selectedTriageReportIds.length === filteredTriageReports.length
                        }
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedTriageReportIds(filteredTriageReports.map((r) => r.id));
                          } else {
                            setSelectedTriageReportIds([]);
                          }
                        }}
                        className="rounded border-[#cbd5e1] text-[#2563eb] cursor-pointer"
                        title="Select All"
                      />
                    </th>
                    <th className="py-2.5 px-2.5 w-10 font-normal text-[#556370]">#</th>
                    <th className="py-2.5 px-3 font-normal text-[#556370]">ID</th>
                    <th className="py-2.5 px-3 font-normal text-[#556370]">Case ID</th>
                    <th className="py-2.5 px-3 font-normal text-[#556370]">Name</th>
                    <th className="py-2.5 px-3 font-normal text-[#556370]">FORM</th>
                    <th className="py-2.5 px-3 font-normal text-[#556370]">SUBMITTED DATE</th>
                    <th className="py-2.5 px-3 font-normal text-[#556370]">Agent</th>
                    <th className="py-2.5 px-3 font-normal text-[#556370]">time and date</th>
                    <th className="py-2.5 px-3 text-center font-normal text-[#556370]">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f1f3f5] text-[#1f272e]">
                  {filteredTriageReports.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-14 text-center">
                        <FileText className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                        <p className="text-[14px] font-semibold text-slate-700">No Reports Found</p>
                        <p className="text-[12px] text-slate-500 mt-1 max-w-sm mx-auto">
                          Submitted beneficiary forms and triage assessments will appear here.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredTriageReports.map((item, index) => {
                      const isSelected = selectedTriageReportIds.includes(item.id);
                      return (
                        <tr
                          key={item.id || index}
                          className={`hover:bg-[#f8f9fa] transition ${
                            isSelected ? "bg-[#f4f7fb]" : ""
                          }`}
                        >
                          <td className="py-2.5 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {
                                setSelectedTriageReportIds((prev) =>
                                  prev.includes(item.id)
                                    ? prev.filter((id) => id !== item.id)
                                    : [...prev, item.id]
                                );
                              }}
                              className="rounded border-[#cbd5e1] text-[#2563eb] cursor-pointer"
                            />
                          </td>
                          <td className="py-2.5 px-2.5 text-[#556370]">{index + 1}</td>
                          <td className="py-2.5 px-3 text-[#556370] font-mono text-[12px]">{item.beneficiaryId}</td>
                          <td className="py-2.5 px-3 text-[#556370] font-mono text-[12px]">{item.caseId || "—"}</td>
                          <td className="py-2.5 px-3 font-medium text-[#1f272e] text-[12.5px]">{item.name || "Beneficiary"}</td>
                          <td className="py-2.5 px-3 text-[#556370] text-[12px]">{item.form}</td>
                          <td className="py-2.5 px-3 text-[#556370] text-[12px]">{item.submittedDate}</td>
                          <td className="py-2.5 px-3 text-[#556370] text-[12px]">{item.agent}</td>
                          <td className="py-2.5 px-3 text-[#556370] text-[12px] whitespace-nowrap">{item.timeAndDate}</td>
                          <td className="py-2.5 px-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedSurvey(item.details);
                                  setSurveyModalOpen(true);
                                }}
                                className="px-2 py-0.5 text-[11.5px] text-[#1a67cc] hover:text-[#0f4ca3] hover:underline font-medium cursor-pointer transition"
                                title="View Form"
                              >
                                View
                              </button>
                              <span className="text-slate-300">|</span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteTriageModal({
                                    isOpen: true,
                                    type: "single",
                                    id: item.id,
                                    caseId: item.caseId,
                                    beneficiaryId: item.beneficiaryId,
                                    count: 1,
                                  });
                                }}
                                className="px-2 py-0.5 text-[11.5px] text-[#dc2626] hover:text-[#b91c1c] hover:underline font-medium cursor-pointer transition"
                                title="Delete Record"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Bottom Pagination Bar matching Beneficiary Page */}
            <div className="px-5 py-2.5 border-t border-[#f1f3f5] bg-white flex items-center justify-between shrink-0 text-[12px] text-[#556370]">
              <div className="flex items-center gap-1.5">
                {["20", "100", "500", "2500"].map((sz, idx) => (
                  <button
                    key={sz}
                    type="button"
                    className={`px-2.5 py-0.5 rounded text-[11.5px] font-medium transition cursor-pointer ${
                      idx === 0
                        ? "bg-[#1a385c] text-white"
                        : "bg-[#f4f5f7] hover:bg-[#e9ecf0] text-[#4b5866]"
                    }`}
                  >
                    {sz}
                  </button>
                ))}
              </div>
              <span className="text-[#8b9aa8]">
                Showing {filteredTriageReports.length} {filteredTriageReports.length === 1 ? "record" : "records"}
              </span>
            </div>
          </main>
        )}

        {/* ================= VIEW 4B: CALL LOG REPORT ================= */}
        {activeNav === "Reports" && (selectedReport === "Call Log Report" || selectedReport === "Beneficiary Call Logs") && (
          <main className="flex-1 flex flex-col bg-white overflow-hidden min-w-0">
            {/* Header: Title + Action Buttons (Export, Refresh, Bulk Delete) */}
            <div className="px-5 pt-4 pb-3 border-b border-[#f1f3f5] flex items-center justify-between shrink-0 bg-white">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedReport(null)}
                  className="text-[#556370] hover:text-[#1a67cc] p-1 rounded hover:bg-[#f4f5f7] transition cursor-pointer mr-1"
                  title="Back to Reports"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <h1 className="text-[18px] font-bold text-[#1f272e]">Call Log Report</h1>
              </div>

              <div className="flex items-center gap-2">
                {selectedCallLogIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteCallLogModal({
                        isOpen: true,
                        type: "bulk",
                        id: null,
                        name: "",
                        count: selectedCallLogIds.length,
                      });
                    }}
                    className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-[12px] font-semibold transition cursor-pointer shadow-xs flex items-center gap-1.5 active:scale-95"
                    title="Bulk Delete Selected"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Delete ({selectedCallLogIds.length})</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleExportCallLogsCsv}
                  className="px-3 py-1 bg-white hover:bg-[#f8f9fa] border border-[#d1d7de] rounded text-[#333e48] transition cursor-pointer text-[12px] font-medium shadow-xs"
                >
                  Export
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const refreshed = loadAllCallLogs();
                    setCallLogsList(refreshed);
                    toast.success("Call logs refreshed");
                  }}
                  className="p-1.5 px-2 bg-white hover:bg-[#f8f9fa] border border-[#d1d7de] rounded text-[#556370] transition cursor-pointer shadow-xs"
                  title="Reload List"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Standard Filter Bar */}
            <div className="px-5 py-2.5 border-b border-[#f1f3f5] flex flex-wrap items-center justify-between gap-3 bg-white shrink-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <input
                  type="text"
                  value={callLogFilterId}
                  onChange={(e) => setCallLogFilterId(e.target.value)}
                  placeholder="ID"
                  className="w-[110px] h-[28px] px-2.5 bg-[#f4f5f7] border border-transparent focus:border-[#2563eb] focus:bg-white rounded text-[12px] text-[#1f272e] placeholder-[#8b9aa8] outline-none transition"
                />
                <input
                  type="text"
                  value={callLogFilterName}
                  onChange={(e) => setCallLogFilterName(e.target.value)}
                  placeholder="Beneficiary Name"
                  className="w-[140px] h-[28px] px-2.5 bg-[#f4f5f7] border border-transparent focus:border-[#2563eb] focus:bg-white rounded text-[12px] text-[#1f272e] placeholder-[#8b9aa8] outline-none transition"
                />
                <input
                  type="text"
                  value={callLogFilterAgent}
                  onChange={(e) => setCallLogFilterAgent(e.target.value)}
                  placeholder="Agent / Admin"
                  className="w-[120px] h-[28px] px-2.5 bg-[#f4f5f7] border border-transparent focus:border-[#2563eb] focus:bg-white rounded text-[12px] text-[#1f272e] placeholder-[#8b9aa8] outline-none transition"
                />
                <input
                  type="text"
                  value={callLogFilterCampaign}
                  onChange={(e) => setCallLogFilterCampaign(e.target.value)}
                  placeholder="Campaign"
                  className="w-[120px] h-[28px] px-2.5 bg-[#f4f5f7] border border-transparent focus:border-[#2563eb] focus:bg-white rounded text-[12px] text-[#1f272e] placeholder-[#8b9aa8] outline-none transition"
                />
              </div>

              <div className="flex items-center gap-3 text-[12px] text-[#8b9aa8]">
                <span>{filteredCallLogs.length} of {callLogsList.length}</span>
              </div>
            </div>

            {/* Table Container */}
            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-left border-collapse text-[12.5px]">
                <thead>
                  <tr className="border-b border-[#e2e8f0] bg-[#fbfcfc] text-[#7b8997] font-normal sticky top-0 z-10">
                    <th className="py-2.5 px-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={
                          filteredCallLogs.length > 0 &&
                          selectedCallLogIds.length === filteredCallLogs.length
                        }
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedCallLogIds(filteredCallLogs.map((r) => r.id));
                          } else {
                            setSelectedCallLogIds([]);
                          }
                        }}
                        className="rounded border-[#cbd5e1] text-[#2563eb] cursor-pointer"
                        title="Select All"
                      />
                    </th>
                    <th className="py-2.5 px-2.5 w-10 font-normal text-[#556370]">#</th>
                    <th className="py-2.5 px-3 font-normal text-[#556370]">ID</th>
                    <th className="py-2.5 px-3 font-normal text-[#556370]">Beneficiary Name</th>
                    <th className="py-2.5 px-3 font-normal text-[#556370]">Date and Time</th>
                    <th className="py-2.5 px-3 font-normal text-[#556370]">Agent ID</th>
                    <th className="py-2.5 px-3 font-normal text-[#556370]">Duration</th>
                    <th className="py-2.5 px-3 font-normal text-[#556370]">Campaign</th>
                    <th className="py-2.5 px-3 font-normal text-[#556370]">Status</th>
                    <th className="py-2.5 px-3 text-center font-normal text-[#556370]">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f1f3f5] text-[#1f272e]">
                  {filteredCallLogs.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-14 text-center">
                        <PhoneCall className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                        <p className="text-[14px] font-semibold text-slate-700">No Call Logs Found</p>
                        <p className="text-[12px] text-slate-500 mt-1 max-w-sm mx-auto">
                          Connected calls received or dialed through CRM will appear here with complete logs.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredCallLogs.map((item, index) => {
                      const isSelected = selectedCallLogIds.includes(item.id);
                      return (
                        <tr
                          key={item.id || index}
                          className={`hover:bg-[#f8f9fa] transition ${
                            isSelected ? "bg-[#f4f7fb]" : ""
                          }`}
                        >
                          <td className="py-2.5 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {
                                setSelectedCallLogIds((prev) =>
                                  prev.includes(item.id)
                                    ? prev.filter((id) => id !== item.id)
                                    : [...prev, item.id]
                                );
                              }}
                              className="rounded border-[#cbd5e1] text-[#2563eb] cursor-pointer"
                            />
                          </td>
                          <td className="py-2.5 px-2.5 text-[#556370]">{index + 1}</td>
                          <td className="py-2.5 px-3 text-[#556370] font-mono text-[12px]">{item.beneficiaryId || "—"}</td>
                          <td className="py-2.5 px-3 font-medium text-[#1f272e] text-[12.5px]">{item.fullName || item.name || "Beneficiary"}</td>
                          <td className="py-2.5 px-3 text-[#556370] text-[12px] whitespace-nowrap">{item.timeAndDate || `${item.date || ""} ${item.time || ""}`}</td>
                          <td className="py-2.5 px-3 text-[#556370] text-[12px]">{item.agent || "Agent 1"}</td>
                          <td className="py-2.5 px-3 text-[#556370] text-[12px] font-mono">{item.duration || "00:00"}</td>
                          <td className="py-2.5 px-3 text-[#556370] text-[12px]">{item.campaign || "Inbound Triage"}</td>
                          <td className="py-2.5 px-3 text-[12px]">
                            <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                              {item.status || "Connected"}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteCallLogModal({
                                  isOpen: true,
                                  type: "single",
                                  id: item.id,
                                  name: item.fullName || item.name || item.beneficiaryId,
                                  count: 1,
                                });
                              }}
                              className="px-2 py-0.5 text-[11.5px] text-[#dc2626] hover:text-[#b91c1c] hover:underline font-medium cursor-pointer transition"
                              title="Delete Call Log"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Bottom Pagination Bar */}
            <div className="px-5 py-2.5 border-t border-[#f1f3f5] bg-white flex items-center justify-between shrink-0 text-[12px] text-[#556370]">
              <div className="flex items-center gap-1.5">
                {["20", "100", "500", "2500"].map((sz, idx) => (
                  <button
                    key={sz}
                    type="button"
                    className={`px-2.5 py-0.5 rounded text-[11.5px] font-medium transition cursor-pointer ${
                      idx === 0
                        ? "bg-[#1a385c] text-white"
                        : "bg-[#f4f5f7] hover:bg-[#e9ecf0] text-[#4b5866]"
                    }`}
                  >
                    {sz}
                  </button>
                ))}
              </div>
              <span className="text-[#8b9aa8]">
                Showing {filteredCallLogs.length} {filteredCallLogs.length === 1 ? "record" : "records"}
              </span>
            </div>
          </main>
        )}

        {/* ================= VIEW 5: TASK LIST (TODO) ================= */}
        {activeNav === "Task List" && (
          <main className="flex-1 flex flex-col bg-white overflow-x-auto overflow-y-auto">
            {/* Page Title & View Action Buttons */}
            <div className="px-5 pt-3.5 pb-2.5 flex items-center justify-between shrink-0">
              <h1 className="text-[20px] font-bold text-[#1f272e] tracking-tight">ToDo</h1>

              <div className="flex items-center gap-1.5 text-[12px]">
                {/* List View Dropdown */}
                <div className="relative" ref={viewMenuRef}>
                  <button
                    type="button"
                    onClick={() => setViewMenuOpen((prev) => !prev)}
                    className="flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-[#f8f9fa] border border-[#d1d7de] rounded text-[#333e48] font-normal transition cursor-pointer"
                  >
                    <div className="flex flex-col gap-0.5">
                      <div className="w-3 h-[2px] bg-[#333e48]" />
                      <div className="w-3 h-[2px] bg-[#333e48]" />
                      <div className="w-3 h-[2px] bg-[#333e48]" />
                    </div>
                    <span>{currentView}</span>
                    <ChevronsUpDown className="h-3 w-3 text-[#697887]" />
                  </button>

                  {viewMenuOpen && (
                    <div className="absolute right-0 top-8 w-36 bg-white text-[#1f272e] rounded shadow-lg border border-[#dce2e8] py-1 text-[12px] z-50">
                      {["List View", "Kanban", "Report"].map((view) => (
                        <button
                          key={view}
                          type="button"
                          onClick={() => {
                            setCurrentView(view);
                            setViewMenuOpen(false);
                          }}
                          className={`w-full text-left px-3 py-1.5 hover:bg-[#f3f5f7] cursor-pointer transition ${
                            currentView === view ? "font-bold text-[#1a385c]" : ""
                          }`}
                        >
                          {view}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Refresh */}
                <button
                  type="button"
                  onClick={handleRefresh}
                  className="p-1.5 bg-white hover:bg-[#f8f9fa] border border-[#d1d7de] rounded text-[#333e48] transition cursor-pointer"
                  title="Refresh list"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
                </button>

                {selectedIds.size > 0 && (
                  <button
                    type="button"
                    onClick={handleBulkDeleteTasks}
                    className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-[12px] font-semibold transition cursor-pointer shadow-xs flex items-center gap-1.5 active:scale-95 animate-in fade-in"
                    title="Delete Selected Tasks"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Delete ({selectedIds.size})</span>
                  </button>
                )}

                {/* More Actions */}
                <button
                  type="button"
                  className="p-1.5 bg-white hover:bg-[#f8f9fa] border border-[#d1d7de] rounded text-[#333e48] transition cursor-pointer"
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Filter Pills Bar */}
            <div className="px-5 py-2 flex flex-wrap items-center gap-2 border-b border-[#f1f3f5] shrink-0 text-[12px]">
              <input
                type="text"
                placeholder="ID"
                value={idFilter}
                onChange={(e) => setIdFilter(e.target.value)}
                className="h-[28px] w-[90px] px-2.5 bg-[#f6f7f8] border border-[#dce2e8] rounded text-[#1f272e] placeholder-[#7d8c9b] outline-none"
              />

              {/* Status Switcher Dropdown */}
              <div className="relative" ref={statusDropdownRef}>
                <button
                  type="button"
                  onClick={() => setStatusDropdownOpen((prev) => !prev)}
                  className="h-[28px] px-2.5 pr-7 bg-white border border-[#dce2e8] rounded text-[#1f272e] font-normal outline-none cursor-pointer hover:border-[#4c84c4] flex items-center justify-between gap-2"
                >
                  <span>{statusFilter}</span>
                  <ChevronsUpDown className="h-3 w-3 text-[#7b8997]" />
                </button>

                {statusDropdownOpen && (
                  <div className="absolute left-0 top-8 w-28 bg-white border border-[#dce2e8] rounded shadow-lg py-1 z-50">
                    {STATUS_OPTIONS.map((opt) => {
                      const isSelected = statusFilter === opt;
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => {
                            setStatusFilter(opt);
                            setStatusDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3 py-1.5 text-[12px] cursor-pointer transition ${
                            isSelected
                              ? "bg-[#1668dc] text-white font-medium"
                              : "text-[#1f272e] hover:bg-[#f3f5f7]"
                          }`}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <input
                type="text"
                placeholder="Campaign"
                value={campaignFilter}
                onChange={(e) => setCampaignFilter(e.target.value)}
                className="h-[28px] w-[100px] px-2.5 bg-[#f6f7f8] border border-[#dce2e8] rounded text-[#1f272e] placeholder-[#7d8c9b] outline-none"
              />

              <input
                type="text"
                placeholder="Allocated To"
                value={allocatedToFilter}
                onChange={(e) => setAllocatedToFilter(e.target.value)}
                className="h-[28px] w-[100px] px-2.5 bg-[#f6f7f8] border border-[#dce2e8] rounded text-[#1f272e] placeholder-[#7d8c9b] outline-none"
              />

              <input
                type="text"
                placeholder="Description"
                value={descriptionFilter}
                onChange={(e) => setDescriptionFilter(e.target.value)}
                className="h-[28px] w-[110px] px-2.5 bg-[#f6f7f8] border border-[#dce2e8] rounded text-[#1f272e] placeholder-[#7d8c9b] outline-none"
              />

              <button
                type="button"
                onClick={() => {
                  setIdFilter("");
                  setStatusFilter("Closed");
                  setCampaignFilter("");
                  setAllocatedToFilter("");
                  setDescriptionFilter("");
                  setSearchQuery("");
                }}
                className="flex items-center gap-1.5 h-[28px] px-2.5 bg-white border border-[#dce2e8] rounded text-[#4b5866] hover:bg-[#f6f7f8] transition cursor-pointer"
              >
                <span>Filter</span>
                <X className="h-3 w-3 text-[#7b8997]" />
              </button>

              <button
                type="button"
                className="flex items-center gap-1.5 h-[28px] px-2.5 bg-white border border-[#dce2e8] rounded text-[#4b5866] hover:bg-[#f6f7f8] transition ml-auto cursor-pointer"
              >
                <span>Created On</span>
              </button>
            </div>

            {/* Tasks Table */}
            <div className="flex-1 overflow-x-auto min-w-[760px]">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#f1f3f5] text-[#556370] text-[12px] font-normal h-[36px]">
                    <th className="w-10 pl-5 pr-2">
                      <button
                        type="button"
                        onClick={toggleSelectAllTasks}
                        className="w-4 h-4 rounded border border-[#c4cdd5] flex items-center justify-center cursor-pointer bg-white"
                      >
                        {selectedIds.size === filteredTasks.length && filteredTasks.length > 0 && (
                          <Check className="h-3 w-3 text-[#1f272e] stroke-[2.5]" />
                        )}
                      </button>
                    </th>
                    <th className="font-normal px-3">Description</th>
                    <th className="font-normal px-3 w-[120px]">Status</th>
                    <th className="font-normal px-3">Campaign</th>
                    <th className="font-normal px-3 w-[110px]">Due Date</th>
                    <th className="font-normal px-3 w-[110px]">ID</th>
                    <th className="font-normal px-4 text-right">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#f1f3f5] text-[#556370] text-[11px]">
                        <span>
                          {Math.min(filteredTasks.length, pageSize)} of {filteredTasks.length}
                        </span>
                        <Heart className="h-2.5 w-2.5 text-[#7b8997]" />
                      </span>
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-[#f7f8f9] text-[13px] text-[#1f272e]">
                  {filteredTasks.slice(0, pageSize).map((rec) => {
                    const isChecked = selectedIds.has(rec.id);
                    return (
                      <tr
                        key={rec.id}
                        onClick={() => handleOpenTaskBeneficiary(rec)}
                        className={`h-[40px] hover:bg-[#fafbfc] transition cursor-pointer ${
                          isChecked ? "bg-[#f4f7fb]" : ""
                        }`}
                      >
                        <td className="w-10 pl-5 pr-2" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={(e) => toggleSelectTaskRow(rec.id, e)}
                            className="w-4 h-4 rounded border border-[#d8e0e8] bg-white flex items-center justify-center cursor-pointer"
                          >
                            {isChecked && <Check className="h-3 w-3 text-[#1f272e] stroke-[2.5]" />}
                          </button>
                        </td>

                        {/* Description (Beneficiary Name) */}
                        <td className="px-3 font-normal text-[#1f272e]">
                          <span
                            onClick={(e) => handleOpenTaskBeneficiary(rec, e)}
                            className="hover:underline hover:text-[#2563eb] cursor-pointer font-medium text-[#1f272e] transition"
                            title="Click to view Beneficiary Details Form"
                          >
                            {rec.name || rec.beneficiaryName}
                          </span>
                        </td>

                        {/* Status with Colored Dot */}
                        <td className="px-3">
                          <div className="flex items-center gap-1.5 text-[12px] text-[#333e48]">
                            {renderStatusDot(rec.status)}
                            <span className="capitalize">{rec.status}</span>
                          </div>
                        </td>

                        {/* Campaign */}
                        <td className="px-3 text-[#556370] text-[12px] truncate max-w-[280px]">
                          <span>{rec.campaign || "Test Campaign"}</span>
                        </td>

                        {/* Due Date */}
                        <td className="px-3 text-[#556370] text-[12px] whitespace-nowrap">
                          <span>{rec.dueDate}</span>
                        </td>

                        {/* ID (8-digit random letters and numbers mix) */}
                        <td className="px-3 text-[#556370] text-[12px] font-mono whitespace-nowrap">
                          <span>{rec.id}</span>
                        </td>

                        {/* Metrics: time, comments, heart */}
                        <td className="px-4 text-right">
                          <div className="flex items-center justify-end gap-3 text-[12px] text-[#556370]">
                            <span>{rec.timeAgo}</span>
                            <div className="flex items-center gap-0.5 cursor-pointer hover:text-[#1f272e]">
                              <MessageSquare className="h-3 w-3 stroke-[1.5]" />
                              <span className="text-[11px]">{rec.comments}</span>
                            </div>
                            <span className="text-[#8b9aa8]">-</span>

                            <button
                              type="button"
                              onClick={(e) => toggleHeart(rec.id, e)}
                              className="p-0.5 cursor-pointer hover:scale-110 transition"
                            >
                              {rec.hasHeart ? (
                                <Heart className="h-3 w-3 fill-black text-black" />
                              ) : (
                                <Heart className="h-3 w-3 text-[#556370] hover:text-black" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="px-5 py-2.5 border-t border-[#f1f3f5] flex items-center justify-between text-[12px] text-[#697887] shrink-0">
              <div className="flex items-center gap-4">
                <span
                  onClick={() => setPageSize(20)}
                  className={`cursor-pointer ${pageSize === 20 ? "text-[#1f272e] font-semibold" : ""}`}
                >
                  20
                </span>
                <span
                  onClick={() => setPageSize(100)}
                  className={`cursor-pointer ${pageSize === 100 ? "text-[#1f272e] font-semibold" : ""}`}
                >
                  100
                </span>
                <span
                  onClick={() => setPageSize(500)}
                  className={`cursor-pointer ${pageSize === 500 ? "text-[#1f272e] font-semibold" : ""}`}
                >
                  500
                </span>
                <span
                  onClick={() => setPageSize(2500)}
                  className={`cursor-pointer ${pageSize === 2500 ? "text-[#1f272e] font-semibold" : ""}`}
                >
                  2500
                </span>
              </div>

              <button
                type="button"
                onClick={handleRefresh}
                className="px-3 py-1 bg-white hover:bg-[#f8f9fa] border border-[#d1d7de] rounded text-[#333e48] transition cursor-pointer text-[12px]"
              >
                Load More
              </button>
            </div>
          </main>
        )}

        {/* ================= 6. BENEFICIARY VIEW ================= */}
        {activeNav === "Beneficiary" && (
          beneficiaryViewMode === "list" ? (
            /* ================= BENEFICIARY LIST VIEW (matching media_1791477741300.png and user HTML) ================= */
            <main className="flex-1 flex flex-col bg-white overflow-hidden min-w-0">
              {/* Header: Title Beneficiary + Export + Reload + Add Beneficiary */}
              <div className="px-5 pt-4 pb-3 border-b border-[#f1f3f5] flex items-center justify-between shrink-0 bg-white">
                <div className="flex items-center gap-2">
                  <h1 className="text-[18px] font-bold text-[#1f272e]">Beneficiary</h1>
                </div>

                <div className="flex items-center gap-2">
                  {selectedBenIds.size > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        setConfirmDeleteModal({
                          isOpen: true,
                          type: "bulk",
                          count: selectedBenIds.size,
                        })
                      }
                      className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-[12px] font-semibold transition cursor-pointer shadow-xs flex items-center gap-1.5 active:scale-95 animate-in fade-in"
                      title="Bulk Delete Selected"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Delete ({selectedBenIds.size})</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => toast.info("Exporting beneficiaries data...")}
                    className="px-3 py-1 bg-white hover:bg-[#f8f9fa] border border-[#d1d7de] rounded text-[#333e48] transition cursor-pointer text-[12px] font-medium shadow-xs"
                  >
                    Export
                  </button>
                  <button
                    type="button"
                    onClick={handleRefresh}
                    className="p-1.5 px-2 bg-white hover:bg-[#f8f9fa] border border-[#d1d7de] rounded text-[#556370] transition cursor-pointer shadow-xs"
                    title="Reload List"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setBeneficiaryData({
                        beneficiaryId: `261008-${Math.floor(10000 + Math.random() * 90000)}`,
                        state: "Assam",
                        center: "Asam Center 1",
                        phoneNumber: "",
                        branching: "Child",
                        firstName: "",
                        lastName: "",
                        gender: "Male",
                        district: "",
                        pinCode: "",
                        block: "",
                        village: "",
                        age: "",
                        addressLine1: "",
                        addressLine2: "",
                        typeOfContact: "",
                        registrationDate: new Date().toLocaleDateString("en-GB") + " " + new Date().toLocaleTimeString("en-GB"),
                        ipNumber: "4300000000",
                        employerName: "",
                        parent: "",
                      });
                      setFormErrors({});
                      setBeneficiaryViewMode("form");
                      if (typeof window !== "undefined") {
                        document.title = "Add Beneficiary";
                        try {
                          window.history.pushState({ page: "beneficiary-form", id: "new" }, '', '/beneficiary?action=new');
                        } catch (_) {}
                      }
                    }}
                    className="flex items-center gap-1.5 px-3 py-1 bg-[#1a385c] hover:bg-[#132c49] text-white rounded text-[12px] font-semibold transition cursor-pointer shadow-xs active:scale-95"
                  >
                    <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
                    <span>Add Beneficiary</span>
                  </button>
                </div>
              </div>

              {/* Standard Filter Bar: ID, Phone Number, Full Name, Filter, Created On */}
              <div className="px-5 py-2.5 border-b border-[#f1f3f5] flex flex-wrap items-center justify-between gap-3 bg-white shrink-0">
                <div className="flex items-center gap-2.5">
                  <input
                    type="text"
                    value={benIdFilter}
                    onChange={(e) => setBenIdFilter(e.target.value)}
                    placeholder="ID"
                    className="w-[110px] h-[28px] px-2.5 bg-[#f4f5f7] border border-transparent focus:border-[#2563eb] focus:bg-white rounded text-[12px] text-[#1f272e] placeholder-[#8b9aa8] outline-none transition"
                  />
                  <input
                    type="text"
                    value={benPhoneFilter}
                    onChange={(e) => setBenPhoneFilter(e.target.value)}
                    placeholder="Phone Number"
                    className="w-[130px] h-[28px] px-2.5 bg-[#f4f5f7] border border-transparent focus:border-[#2563eb] focus:bg-white rounded text-[12px] text-[#1f272e] placeholder-[#8b9aa8] outline-none transition"
                  />
                  <input
                    type="text"
                    value={benNameFilter}
                    onChange={(e) => setBenNameFilter(e.target.value)}
                    placeholder="Full Name"
                    className="w-[140px] h-[28px] px-2.5 bg-[#f4f5f7] border border-transparent focus:border-[#2563eb] focus:bg-white rounded text-[12px] text-[#1f272e] placeholder-[#8b9aa8] outline-none transition"
                  />
                  <select
                    value={benDistrictFilter}
                    onChange={(e) => setBenDistrictFilter(e.target.value)}
                    className="h-[28px] px-2 bg-[#f4f5f7] border border-transparent focus:border-[#2563eb] focus:bg-white rounded text-[12px] text-[#1f272e] outline-none transition cursor-pointer max-w-[140px]"
                    title="Filter by Assam District"
                  >
                    <option value="">All Districts</option>
                    {ASSAM_DISTRICTS.map((dist) => (
                      <option key={dist} value={dist}>
                        {dist}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2 text-[12px]">
                  {/* Filter pill */}
                  <div className="flex items-center border border-[#d1d7de] rounded overflow-hidden bg-white shadow-2xs">
                    <button
                      type="button"
                      className="flex items-center gap-1.5 px-2.5 py-1 text-[#4b5866] hover:bg-[#f8f9fa] transition font-medium cursor-pointer"
                    >
                      <Filter className="h-3 w-3 text-[#7b8997]" />
                      <span>Filter</span>
                    </button>
                    {(benIdFilter || benPhoneFilter || benNameFilter || benDistrictFilter) && (
                      <button
                        type="button"
                        onClick={() => {
                          setBenIdFilter("");
                          setBenPhoneFilter("");
                          setBenNameFilter("");
                          setBenDistrictFilter("");
                        }}
                        className="px-1.5 py-1 border-l border-[#d1d7de] text-[#7b8997] hover:text-[#1f272e] hover:bg-[#f8f9fa] transition cursor-pointer"
                        title="Clear all filters"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>

                  {/* Sort selector */}
                  <div className="relative flex items-center border border-[#d1d7de] rounded bg-white shadow-2xs">
                    <button
                      type="button"
                      onClick={() => setBenSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))}
                      className="px-2 py-1 border-r border-[#d1d7de] text-[#556370] hover:bg-[#f8f9fa] transition cursor-pointer"
                      title={benSortOrder === "asc" ? "Ascending" : "Descending"}
                    >
                      <ArrowDownUp className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setBenSortDropdownOpen(!benSortDropdownOpen)}
                      className="px-2.5 py-1 text-[#4b5866] hover:bg-[#f8f9fa] transition flex items-center gap-1 cursor-pointer font-medium"
                    >
                      <span>{benSortField}</span>
                      <ChevronDown className="h-3 w-3 text-[#7b8997]" />
                    </button>

                    {benSortDropdownOpen && (
                      <div className="absolute right-0 top-8 w-44 bg-white rounded shadow-lg border border-[#d1d7de] py-1 z-30 text-[12px]">
                        {["Created On", "Full Name", "ID", "Phone Number", "Registration Date"].map((opt) => (
                          <div
                            key={opt}
                            onClick={() => {
                              setBenSortField(opt);
                              setBenSortDropdownOpen(false);
                            }}
                            className="px-3 py-1.5 hover:bg-[#f0f2f5] cursor-pointer text-[#1f272e]"
                          >
                            {opt}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Table / List Container */}
              <div className="flex-1 overflow-y-auto">
                <table className="w-full text-left border-collapse text-[12.5px]">
                  {/* Table Head */}
                  <thead>
                    <tr className="border-b border-[#e2e8f0] bg-[#fbfcfc] text-[#7b8997] font-normal sticky top-0 z-10">
                      <th className="py-2.5 px-3 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={selectedBenIds.size === filteredBeneficiaries.length && filteredBeneficiaries.length > 0}
                          onChange={toggleSelectAllBeneficiaries}
                          className="rounded border-[#cbd5e1] text-[#2563eb] cursor-pointer"
                        />
                      </th>
                      <th className="py-2.5 px-3 min-w-[170px] font-normal text-[#556370]">Full Name</th>
                      <th className="py-2.5 px-3 min-w-[70px] font-normal text-[#556370]">State</th>
                      <th className="py-2.5 px-3 min-w-[110px] font-normal text-[#556370]">Center</th>
                      <th className="py-2.5 px-3 min-w-[125px] font-normal text-[#556370]">Phone Number</th>
                      <th className="py-2.5 px-3 min-w-[90px] font-normal text-[#556370]">Branching</th>
                      <th className="py-2.5 px-3 min-w-[145px] font-normal text-[#556370]">Registration Date</th>
                      <th className="py-2.5 px-3 min-w-[100px] font-normal text-[#556370]">ID</th>
                      <th className="py-2.5 px-3 text-right text-[11.5px] text-[#8b9aa8] font-normal">
                        <div className="flex items-center justify-end gap-3 pr-2">
                          <span suppressHydrationWarning>{Math.min(filteredBeneficiaries.length, benPageSize)} of {filteredBeneficiaries.length}</span>
                          <Heart className="h-3.5 w-3.5 text-[#cbd5e1]" />
                        </div>
                      </th>
                    </tr>
                  </thead>

                  {/* Table Body */}
                  <tbody className="divide-y divide-[#f1f3f5] text-[#1f272e]">
                    {filteredBeneficiaries.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-14 text-center">
                          <User className="h-9 w-9 text-slate-300 mx-auto mb-2" />
                          <p className="text-[14px] font-semibold text-slate-700">No beneficiaries registered</p>
                          <p className="text-[12px] text-slate-500 mt-1 max-w-sm mx-auto">
                            When an incoming call arrives or you click &quot;+ Add Beneficiary&quot;, saved records will appear here.
                          </p>
                        </td>
                      </tr>
                    ) : (
                      filteredBeneficiaries.slice(0, benPageSize).map((ben) => {
                        const isSelected = selectedBenIds.has(ben.id);
                        const isLiked = likedBenIds.has(ben.id);
                        return (
                          <tr
                            key={ben.id}
                            className={`hover:bg-[#f8f9fa] transition cursor-pointer group ${
                              isSelected ? "bg-[#f4f7fb]" : ""
                            }`}
                          >
                            {/* Checkbox */}
                            <td className="py-2.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => toggleSelectBenRow(ben.id, e)}
                                className="rounded border-[#cbd5e1] text-[#2563eb] cursor-pointer"
                              />
                            </td>

                            {/* Full Name */}
                            <td
                              className="py-2.5 px-3 font-bold text-[#1f272e] hover:text-[#2563eb] transition truncate max-w-[200px]"
                              onClick={() => handleOpenBeneficiaryDetail(ben)}
                              title={ben.fullName}
                            >
                              {ben.fullName}
                            </td>

                            {/* State */}
                            <td
                              className="py-2.5 px-3 text-[#4b5866] truncate"
                              onClick={() => handleOpenBeneficiaryDetail(ben)}
                            >
                              {ben.state}
                            </td>

                            {/* Center */}
                            <td
                              className="py-2.5 px-3 text-[#4b5866] truncate"
                              onClick={() => handleOpenBeneficiaryDetail(ben)}
                            >
                              {ben.center}
                            </td>

                            {/* Phone Number */}
                            <td
                              className="py-2.5 px-3 text-[#4b5866] font-mono text-[12px] truncate"
                              onClick={() => handleOpenBeneficiaryDetail(ben)}
                            >
                              {ben.phoneNumber}
                            </td>

                            {/* Branching */}
                            <td
                              className="py-2.5 px-3"
                              onClick={() => handleOpenBeneficiaryDetail(ben)}
                            >
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#eef1f4] text-[#4b5866]">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#64748b]"></span>
                                <span>{ben.branching}</span>
                              </span>
                            </td>

                            {/* Registration Date */}
                            <td
                              className="py-2.5 px-3 text-[#556370] text-[12px] truncate"
                              onClick={() => handleOpenBeneficiaryDetail(ben)}
                            >
                              {ben.registrationDate}
                            </td>

                            {/* ID */}
                            <td
                              className="py-2.5 px-3 text-[#556370] font-mono text-[12px] truncate"
                              onClick={() => handleOpenBeneficiaryDetail(ben)}
                            >
                              {ben.id}
                            </td>

                            {/* Activity: timeAgo, comments, heart, delete */}
                            <td className="py-2.5 px-3 text-right">
                              <div className="flex items-center justify-end gap-2 text-[#7b8997] text-[11.5px] pr-2">
                                {/* Time */}
                                <span className="text-[#8b9aa8] min-w-[28px] text-right">{ben.timeAgo}</span>

                                {/* Comments */}
                                <span className="flex items-center gap-0.5 text-[#8b9aa8]">
                                  <MessageSquare className="h-3 w-3 stroke-[1.8]" />
                                  <span>{ben.comments}</span>
                                </span>

                                <span>·</span>

                                {/* Heart */}
                                <button
                                  type="button"
                                  onClick={(e) => toggleLikeBenRow(ben.id, e)}
                                  className="cursor-pointer hover:scale-110 transition p-0.5"
                                  title="Like"
                                >
                                  <Heart
                                    className={`h-3.5 w-3.5 ${
                                      isLiked
                                        ? "fill-rose-500 text-rose-500"
                                        : "text-[#cbd5e1] hover:text-rose-400"
                                    }`}
                                  />
                                </button>

                                {/* Delete row */}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setConfirmDeleteModal({
                                      isOpen: true,
                                      type: "single",
                                      id: ben.id,
                                      name: ben.fullName || ben.id,
                                    });
                                  }}
                                  className="cursor-pointer hover:scale-110 transition p-0.5 text-[#cbd5e1] hover:text-rose-600"
                                  title="Delete Beneficiary"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Bottom Pagination Bar: 20, 100, 500, 2500, Load More */}
              <div className="px-5 py-3 border-t border-[#f1f3f5] flex items-center justify-between text-[12px] bg-white shrink-0">
                <div className="flex items-center gap-1.5">
                  {[20, 100, 500, 2500].map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setBenPageSize(size)}
                      className={`px-3 py-1 rounded border text-[12px] font-medium transition cursor-pointer ${
                        benPageSize === size
                          ? "bg-[#1a385c] text-white border-[#1a385c]"
                          : "bg-white text-[#4b5866] border-[#d1d7de] hover:bg-[#f8f9fa]"
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleRefresh}
                  className="px-3.5 py-1 bg-white hover:bg-[#f8f9fa] border border-[#d1d7de] rounded text-[#333e48] transition cursor-pointer text-[12px] font-medium shadow-xs"
                >
                  Load More
                </button>
              </div>
            </main>
          ) : (
            /* ================= BENEFICIARY FORM VIEW ================= */
            <main className="flex-1 overflow-y-auto bg-white p-6 pb-28">
              {/* Header: Title Jyotirmoy + Call + Save */}
              <div className="flex items-center justify-between pb-4 border-b border-[#f1f3f5] mb-5">
              <div className="flex items-center gap-3">
                <h2 className="text-[22px] font-bold text-[#1f272e] tracking-tight">
                  {`${beneficiaryData.firstName || ""} ${beneficiaryData.lastName || ""}`.trim() || "Beneficiary"}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setCzBarOpen(true);
                    setCzBarMinimized(false);
                    setCzPhoneNumber(beneficiaryData.phoneNumber);
                    toast.info(`Calling ${`${beneficiaryData.firstName || ""} ${beneficiaryData.lastName || ""}`.trim() || "Beneficiary"} (+91 ${beneficiaryData.phoneNumber})...`);
                  }}
                  className="px-3.5 py-1.5 bg-white hover:bg-[#f8f9fa] border border-[#d1d7de] rounded text-[#1f272e] font-medium text-[13px] transition cursor-pointer shadow-xs active:scale-95"
                >
                  Call
                </button>
                <button
                  type="button"
                  onClick={handleSaveBeneficiary}
                  className="px-4 py-1.5 bg-[#1f272e] hover:bg-[#111827] text-white font-medium text-[13px] rounded transition cursor-pointer shadow-xs active:scale-95 flex items-center gap-1.5"
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>Save</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBeneficiaryViewMode("list");
                    if (typeof window !== "undefined") {
                      document.title = "Beneficiary";
                      try {
                        window.history.pushState({ page: "beneficiary-list" }, '', '/beneficiary');
                      } catch (_) {}
                    }
                  }}
                  className="px-3.5 py-1.5 bg-white hover:bg-[#f8f9fa] border border-[#d1d7de] rounded text-[#556370] hover:text-[#1f272e] font-medium text-[13px] transition cursor-pointer shadow-xs active:scale-95 flex items-center gap-1.5"
                  title="Close Form & Back to Beneficiary List"
                >
                  <X className="h-3.5 w-3.5" />
                  <span>Close</span>
                </button>
              </div>
            </div>

            {/* Form Section 1: 4 Columns (State, Center, Phone Number, Branching) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
              <div>
                <label className="block text-[12px] text-[#556370] font-medium mb-1">
                  State <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={beneficiaryData.state}
                  onChange={(e) => updateBeneficiaryField("state", e.target.value)}
                  className={`w-full bg-[#f4f5f7] border ${formErrors.state ? "border-rose-500 bg-rose-50/20 ring-1 ring-rose-400" : "border-transparent focus:border-[#2563eb]"} focus:bg-white rounded px-2.5 py-1.5 text-[13px] text-[#1f272e] outline-none transition`}
                />
              </div>

              <div>
                <label className="block text-[12px] text-[#556370] font-medium mb-1">
                  Center <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={beneficiaryData.center}
                  onChange={(e) => updateBeneficiaryField("center", e.target.value)}
                  className={`w-full bg-[#f4f5f7] border ${formErrors.center ? "border-rose-500 bg-rose-50/20 ring-1 ring-rose-400" : "border-transparent focus:border-[#2563eb]"} focus:bg-white rounded px-2.5 py-1.5 text-[13px] text-[#1f272e] outline-none transition`}
                />
              </div>

              <div>
                <label className="block text-[12px] text-[#556370] font-medium mb-1">
                  Phone Number <span className="text-red-500">*</span>
                </label>
                <div className={`flex items-center bg-[#f4f5f7] rounded border ${formErrors.phoneNumber ? "border-rose-500 bg-rose-50/20 ring-1 ring-rose-400" : "border-transparent focus-within:border-[#2563eb]"} focus-within:bg-white px-2.5 py-1.5 transition`}>
                  <span className="text-base mr-1.5 select-none">🇮🇳</span>
                  <span className="text-[13px] text-[#556370] mr-1.5 font-medium select-none">+91</span>
                  <input
                    type="text"
                    value={beneficiaryData.phoneNumber}
                    onChange={(e) => updateBeneficiaryField("phoneNumber", e.target.value)}
                    className="bg-transparent border-0 outline-none text-[13px] text-[#1f272e] w-full font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[12px] text-[#556370] font-medium mb-1">
                  Branching <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={beneficiaryData.branching}
                  onChange={(e) => updateBeneficiaryField("branching", e.target.value)}
                  className={`w-full bg-[#f4f5f7] border ${formErrors.branching ? "border-rose-500 bg-rose-50/20 ring-1 ring-rose-400" : "border-transparent focus:border-[#2563eb]"} focus:bg-white rounded px-2.5 py-1.5 text-[13px] text-[#1f272e] outline-none transition`}
                />
              </div>
            </div>

            {/* Form Section 2: 4 Columns x 4 Rows */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {/* Row 1 */}
              <div>
                <label className="block text-[12px] text-[#556370] font-medium mb-1">
                  First Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={beneficiaryData.firstName}
                  onChange={(e) => updateBeneficiaryField("firstName", e.target.value)}
                  className={`w-full bg-[#f4f5f7] border ${formErrors.firstName ? "border-rose-500 bg-rose-50/20 ring-1 ring-rose-400" : "border-transparent focus:border-[#2563eb]"} focus:bg-white rounded px-2.5 py-1.5 text-[13px] text-[#1f272e] outline-none transition font-medium`}
                />
              </div>

              <div>
                <label className="block text-[12px] text-[#556370] font-medium mb-1">
                  Last Name
                </label>
                <input
                  type="text"
                  value={beneficiaryData.lastName}
                  onChange={(e) => updateBeneficiaryField("lastName", e.target.value)}
                  placeholder="Enter last name"
                  className="w-full bg-[#f4f5f7] border border-transparent focus:border-[#2563eb] focus:bg-white rounded px-2.5 py-1.5 text-[13px] text-[#1f272e] placeholder-[#94a3b8] outline-none transition"
                />
              </div>

              <div>
                <label className="block text-[12px] text-[#556370] font-medium mb-1">
                  Gender <span className="text-red-500">*</span>
                </label>
                <select
                  value={beneficiaryData.gender}
                  onChange={(e) => updateBeneficiaryField("gender", e.target.value)}
                  className={`w-full bg-[#f4f5f7] border ${formErrors.gender ? "border-rose-500 bg-rose-50/20 ring-1 ring-rose-400" : "border-transparent focus:border-[#2563eb]"} focus:bg-white rounded px-2.5 py-1.5 text-[13px] text-[#1f272e] outline-none transition cursor-pointer`}
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Others">Others</option>
                </select>
              </div>

              <div>
                <label className="block text-[12px] text-[#556370] font-medium mb-1">
                  Age
                </label>
                <input
                  type="text"
                  value={beneficiaryData.age}
                  onChange={(e) => updateBeneficiaryField("age", e.target.value)}
                  placeholder="0"
                  className="w-full bg-[#f4f5f7] border border-transparent focus:border-[#2563eb] focus:bg-white rounded px-2.5 py-1.5 text-[13px] text-[#1f272e] placeholder-[#94a3b8] outline-none transition"
                />
              </div>

              {/* Row 2 / Section 3 */}
              <div>
                <label className="block text-[12px] text-[#556370] font-medium mb-1">
                  District <span className="text-red-500">*</span>
                </label>
                <select
                  value={beneficiaryData.district}
                  onChange={(e) => updateBeneficiaryField("district", e.target.value)}
                  className={`w-full bg-[#f4f5f7] border ${formErrors.district ? "border-rose-500 bg-rose-50/20 ring-1 ring-rose-400" : "border-transparent focus:border-[#2563eb]"} focus:bg-white rounded px-2.5 py-1.5 text-[13px] text-[#1f272e] outline-none transition cursor-pointer`}
                >
                  <option value="">Select District</option>
                  {ASSAM_DISTRICTS.map((dist) => (
                    <option key={dist} value={dist}>
                      {dist}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[12px] text-[#556370] font-medium mb-1">
                  Pin Code
                </label>
                <input
                  type="text"
                  value={beneficiaryData.pinCode || ""}
                  onChange={(e) => updateBeneficiaryField("pinCode", e.target.value)}
                  placeholder="Enter Pin Code"
                  className="w-full bg-[#f4f5f7] border border-transparent focus:border-[#2563eb] focus:bg-white rounded px-2.5 py-1.5 text-[13px] text-[#1f272e] placeholder-[#94a3b8] outline-none transition"
                />
              </div>

              <div>
                <label className="block text-[12px] text-[#556370] font-medium mb-1">
                  Block
                </label>
                <input
                  type="text"
                  value={beneficiaryData.block}
                  onChange={(e) => updateBeneficiaryField("block", e.target.value)}
                  placeholder="Select a Block"
                  className="w-full bg-[#f4f5f7] border border-transparent focus:border-[#2563eb] focus:bg-white rounded px-2.5 py-1.5 text-[13px] text-[#1f272e] placeholder-[#94a3b8] outline-none transition"
                />
              </div>

              <div>
                <label className="block text-[12px] text-[#556370] font-medium mb-1">
                  Village
                </label>
                <input
                  type="text"
                  value={beneficiaryData.village}
                  onChange={(e) => updateBeneficiaryField("village", e.target.value)}
                  placeholder="Select a Village"
                  className="w-full bg-[#f4f5f7] border border-transparent focus:border-[#2563eb] focus:bg-white rounded px-2.5 py-1.5 text-[13px] text-[#1f272e] placeholder-[#94a3b8] outline-none transition"
                />
              </div>

              {/* Row 3 */}
              <div>
                <label className="block text-[12px] text-[#556370] font-medium mb-1">
                  Address Line 1
                </label>
                <input
                  type="text"
                  value={beneficiaryData.addressLine1}
                  onChange={(e) => updateBeneficiaryField("addressLine1", e.target.value)}
                  placeholder="Enter address1"
                  className="w-full bg-[#f4f5f7] border border-transparent focus:border-[#2563eb] focus:bg-white rounded px-2.5 py-1.5 text-[13px] text-[#1f272e] placeholder-[#94a3b8] outline-none transition"
                />
              </div>

              <div>
                <label className="block text-[12px] text-[#556370] font-medium mb-1">
                  Address Line 2
                </label>
                <input
                  type="text"
                  value={beneficiaryData.addressLine2}
                  onChange={(e) => updateBeneficiaryField("addressLine2", e.target.value)}
                  placeholder="Enter address2"
                  className="w-full bg-[#f4f5f7] border border-transparent focus:border-[#2563eb] focus:bg-white rounded px-2.5 py-1.5 text-[13px] text-[#1f272e] placeholder-[#94a3b8] outline-none transition"
                />
              </div>

              <div>
                <label className="block text-[12px] text-[#556370] font-medium mb-1">
                  Type Of Contact
                </label>
                <input
                  type="text"
                  value={beneficiaryData.typeOfContact}
                  onChange={(e) => updateBeneficiaryField("typeOfContact", e.target.value)}
                  placeholder="Select type of Contact"
                  className="w-full bg-[#f4f5f7] border border-transparent focus:border-[#2563eb] focus:bg-white rounded px-2.5 py-1.5 text-[13px] text-[#1f272e] placeholder-[#94a3b8] outline-none transition"
                />
              </div>

              <div>
                <label className="block text-[12px] text-[#556370] font-medium mb-1">
                  Registration Date
                </label>
                <input
                  type="text"
                  value={beneficiaryData.registrationDate}
                  onChange={(e) => updateBeneficiaryField("registrationDate", e.target.value)}
                  className="w-full bg-[#f4f5f7] border border-transparent focus:border-[#2563eb] focus:bg-white rounded px-2.5 py-1.5 text-[13px] text-[#1f272e] outline-none transition"
                />
              </div>

              {/* Row 4 */}
              <div>
                <label className="block text-[12px] text-[#556370] font-medium mb-1">
                  Ip Number
                </label>
                <input
                  type="text"
                  value={beneficiaryData.ipNumber}
                  onChange={(e) => updateBeneficiaryField("ipNumber", e.target.value)}
                  className="w-full bg-[#f4f5f7] border border-transparent focus:border-[#2563eb] focus:bg-white rounded px-2.5 py-1.5 text-[13px] text-[#1f272e] outline-none transition font-medium"
                />
              </div>

              <div>
                <label className="block text-[12px] text-[#556370] font-medium mb-1">
                  Employer Name
                </label>
                <input
                  type="text"
                  value={beneficiaryData.employerName}
                  onChange={(e) => updateBeneficiaryField("employerName", e.target.value)}
                  className="w-full bg-[#f4f5f7] border border-transparent focus:border-[#2563eb] focus:bg-white rounded px-2.5 py-1.5 text-[13px] text-[#1f272e] outline-none transition"
                />
              </div>

              <div className="hidden lg:block"></div>

              <div>
                <label className="block text-[12px] text-[#556370] font-medium mb-1">
                  Parent
                </label>
                <input
                  type="text"
                  value={beneficiaryData.parent}
                  onChange={(e) => updateBeneficiaryField("parent", e.target.value)}
                  className="w-full bg-[#f4f5f7] border border-transparent focus:border-[#2563eb] focus:bg-white rounded px-2.5 py-1.5 text-[13px] text-[#1f272e] outline-none transition font-medium"
                />
              </div>
            </div>

            {/* Section 3: Two Side-by-Side Tables (Campaigns & Survey Answers) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-6">
              {/* Table 1: Campaigns */}
              <div className="border border-[#e2e8f0] rounded overflow-hidden bg-white shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-[12px]">
                    <thead>
                      <tr className="border-b border-[#e2e8f0] bg-[#f8f9fa] text-[#556370] font-semibold">
                        <th className="py-2.5 px-3 w-10">#</th>
                        <th className="py-2.5 px-3">CAMPAIGN NAME</th>
                        <th className="py-2.5 px-3">STATUS</th>
                        <th className="py-2.5 px-3">CREATED</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#e2e8f0] text-[#1f272e]">
                      <tr
                        onClick={() => setSelectedCampaignId(selectedCampaignId === 1 ? null : 1)}
                        className="hover:bg-[#f8f9fa] transition cursor-pointer"
                      >
                        <td className="py-2.5 px-3 text-[#556370]">1</td>
                        <td className="py-2.5 px-3 font-medium">Test Outbound Campaign</td>
                        <td className="py-2.5 px-3">
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#64748b] text-white">
                            Inactive
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-[#556370]">21-08-2026</td>
                      </tr>
                      <tr
                        onClick={() => {
                          setSelectedCampaignId(2);
                          setEsicFormData({
                            form: "INFORMATION",
                            q_awareness: "Yes",
                            q_info_type: "1. About ESIS",
                            q_coverage: "Yes",
                            q_benefit_type: "Medical Benefits",
                            q_benefit_others: "",
                            q_claims: "Yes",
                            q_reimbursements: "Yes",
                            q_card_changes: "Name correction",
                            q_card_others: "",
                            q_followup: "Yes",
                            q_rating: "0",
                            next_followup: "",
                            call_type: "",
                            category: "",
                            sub_category: "",
                          });
                          setEsicFormErrors({});
                          setEsicModalOpen(true);
                        }}
                        className="hover:bg-[#f8f9fa] transition cursor-pointer"
                        title="Click to open Survey Form for ESIC INBOUND"
                      >
                        <td className="py-2.5 px-3 text-[#556370]">2</td>
                        <td className="py-2.5 px-3 font-medium text-[#1f272e] hover:text-[#2563eb]">
                          ESIC INBOUND
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#1e293b] text-white">
                            Active
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-[#556370]">21-08-2026</td>
                      </tr>
                      <tr
                        onClick={() => {
                          setSelectedCampaignId(3);
                          handleOpenInboundTriageModal();
                        }}
                        className="hover:bg-[#f8f9fa] transition cursor-pointer"
                        title="Click to open Inbound Triage Form"
                      >
                        <td className="py-2.5 px-3 text-[#556370]">3</td>
                        <td className="py-2.5 px-3 font-semibold text-[#1f272e] hover:text-[#2563eb]">
                          <span>Inbound Triage</span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#2563eb] text-white">
                            Active
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-[#556370]">09-10-2026</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Table 2: Survey Answers / History (Right Side Area) */}
              <div className="border border-[#e2e8f0] rounded overflow-hidden bg-white shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-[12px]">
                    <thead>
                      <tr className="border-b border-[#e2e8f0] bg-[#f8f9fa] text-[#556370] font-semibold">
                        <th className="py-2.5 px-2.5 w-8">#</th>
                        <th className="py-2.5 px-2.5">CAMPAIGN</th>
                        <th className="py-2.5 px-2.5">FORM</th>
                        <th className="py-2.5 px-2.5">FOLLOWUP</th>
                        <th className="py-2.5 px-2.5">SUBMITTED DATE</th>
                        <th className="py-2.5 px-2.5">ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#e2e8f0] text-[#1f272e]">
                      {surveyHistory.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-[#94a3b8] text-[12.5px] italic">
                            No submitted survey records found for this beneficiary
                          </td>
                        </tr>
                      ) : (
                        surveyHistory.map((item, index) => {
                          return (
                            <tr
                              key={item.id || index}
                              className="hover:bg-[#f8f9fa] transition cursor-pointer"
                            >
                              <td className="py-2.5 px-2.5 text-[#556370]">
                                {index + 1}
                              </td>
                              <td className="py-2.5 px-2.5 font-medium">{item.campaign}</td>
                              <td className="py-2.5 px-2.5 text-[#475569]">
                                {item.form}
                              </td>
                              <td className="py-2.5 px-2.5 text-[#556370]">
                                {item.followup}
                              </td>
                              <td className="py-2.5 px-2.5 text-[#556370]">
                                {item.submittedDate}
                              </td>
                              <td className="py-2.5 px-2.5">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedSurveyRowId(item.id);
                                    setSelectedSurvey(item.details);
                                    setSurveyModalOpen(true);
                                  }}
                                  className="px-2.5 py-1 rounded text-[11px] font-medium flex items-center gap-1 cursor-pointer transition active:scale-95 shadow-2xs bg-[#1e293b] hover:bg-[#0f172a] text-white"
                                >
                                  <Eye className="h-3 w-3" />
                                  <span>View</span>
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Section 4: Collapsible Call History */}
            <div className="mt-8 border-t border-[#f1f3f5] pt-4">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setCallHistoryExpanded(!callHistoryExpanded)}
                  className="flex items-center gap-2 text-[14px] font-semibold text-[#1f272e] hover:text-[#2563eb] transition cursor-pointer"
                >
                  <span>Call History</span>
                  {visibleCallHistory.length > 0 && (
                    <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-blue-50 text-blue-600 border border-blue-200">
                      {visibleCallHistory.length}
                    </span>
                  )}
                  <ChevronDown
                    className={`h-4 w-4 text-[#7b8997] transition-transform ${callHistoryExpanded ? "rotate-180" : ""}`}
                  />
                </button>
                {visibleCallHistory.length > 0 && (
                  <span className="text-[12px] text-slate-500">
                    Last Activity: <strong className="text-slate-700">{visibleCallHistory[0]?.timestamp || `${visibleCallHistory[0]?.date} ${visibleCallHistory[0]?.time}`}</strong>
                  </span>
                )}
              </div>

              {callHistoryExpanded && (
                <div className="mt-3">
                  {visibleCallHistory.length === 0 ? (
                    <div className="p-4 bg-[#f8f9fa] border border-[#e2e8f0] rounded text-[12.5px] text-[#64748b]">
                      <span>No call history found for this beneficiary</span>
                    </div>
                  ) : (
                    <div className="border border-[#e2e8f0] rounded-md overflow-hidden bg-white shadow-2xs">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-[12.5px]">
                          <thead className="bg-[#f8f9fa] border-b border-[#e2e8f0] text-[#556370]">
                            <tr>
                              <th className="py-2.5 px-3 font-semibold w-10 text-center">#</th>
                              <th className="py-2.5 px-3 font-semibold whitespace-nowrap">
                                Date & Time
                              </th>
                              <th className="py-2.5 px-3 font-semibold whitespace-nowrap">Campaign</th>
                              <th className="py-2.5 px-3 font-semibold whitespace-nowrap">Agent</th>
                              <th className="py-2.5 px-3 font-semibold whitespace-nowrap">Duration</th>
                              <th className="py-2.5 px-3 font-semibold whitespace-nowrap">Status</th>
                              <th className="py-2.5 px-3 font-semibold text-left w-full pl-6">Notes</th>
                              <th className="py-2.5 px-3 font-semibold text-center whitespace-nowrap">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#f1f3f5] text-[#1f272e]">
                            {visibleCallHistory.map((item, idx) => {
                              const isConn = item.callConnected ?? (item.status === "Connected" && item.duration !== "00:00" && item.duration !== "0" && !String(item.notes || "").toLowerCase().includes("no call"));
                              const formName = item.callType === "ESIC Inbound" || item.campaign === "ESIC INBOUND" || String(item.notes || "").toLowerCase().includes("esic")
                                ? "ESIC Inbound Form"
                                : "Inbound Triage Form";
                              const noteText = isConn
                                ? `Inbound call connected, ${formName} filled`
                                : `No call, ${formName} filled`;

                              return (
                                <tr
                                  key={item.id || idx}
                                  className="hover:bg-[#fcfdfe] transition group"
                                >
                                  <td className="py-2.5 px-3 text-center font-mono text-[11.5px] text-slate-400 whitespace-nowrap">
                                    {idx + 1}
                                  </td>
                                  <td className="py-2.5 px-3 whitespace-nowrap">
                                    <span className="font-semibold font-mono text-[12px] text-[#1e293b]">
                                      {item.timestamp || `${item.date} ${item.time}`}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-3 text-[#1f272e] whitespace-nowrap font-normal">
                                    {item.campaign || item.callType || "Inbound Triage"}
                                  </td>
                                  <td className="py-2.5 px-3 font-semibold font-mono text-[12px] text-slate-800 whitespace-nowrap">
                                    {item.agent && item.agent !== "Administrator" ? item.agent : (activeAgentId || "Agent 1")}
                                  </td>
                                  <td className="py-2.5 px-3 font-mono text-[12px] text-slate-600 whitespace-nowrap">
                                    {isConn ? (item.duration || "00:00") : "00:00"}
                                  </td>
                                  <td className="py-2.5 px-3 text-[12px] text-slate-600 whitespace-nowrap font-normal">
                                    {isConn ? "Connected" : "Not connected"}
                                  </td>
                                  <td className="py-2.5 px-3 text-[12px] text-slate-700 pl-6">
                                    {noteText}
                                  </td>
                                  <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setDeleteCallLogModal({
                                          isOpen: true,
                                          type: "single",
                                          id: item.id,
                                          name: item.fullName || beneficiaryData.fullName || "Call Record",
                                          count: 1,
                                        });
                                      }}
                                      className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition cursor-pointer"
                                      title="Delete call log"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Survey Answers Modal rendered at root level */}

            {/* Survey Forms Modal (ESIC Inbound) exactly matching media_1791484537132.png and media_1791615277370.png */}
            {esicModalOpen && (
              <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-2xs flex items-center justify-center p-3 sm:p-5">
                <div className="bg-white rounded-xl shadow-2xl max-w-[1240px] w-[95vw] border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
                  {/* Modal Header */}
                  <div className="px-8 py-4 border-b border-[#f1f3f5] flex items-center justify-between bg-white shrink-0">
                    <h4 className="font-semibold text-[#1f272e] text-[16px]">Survey Forms</h4>
                    <button
                      type="button"
                      onClick={() => setEsicModalOpen(false)}
                      className="text-slate-400 hover:text-slate-700 transition cursor-pointer p-1 rounded hover:bg-slate-100"
                      title="Close"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Modal Body */}
                  <form onSubmit={handleSaveEsicSurvey} className="flex-1 overflow-y-auto px-8 py-5 flex flex-col">
                    {/* Top: Form (Full Width across the whole dialog) */}
                    <div className="mb-4">
                      <label className="block text-[12px] text-[#4b5866] font-medium mb-1.5">
                        Form <span className="text-red-500 font-bold">*</span>
                      </label>
                      <div className="relative w-full">
                        <select
                          value={esicFormData.form}
                          onChange={(e) => setEsicFormData({ ...esicFormData, form: e.target.value })}
                          className="w-full bg-[#fcfdfd] border border-[#d1d7de] focus:border-[#2563eb] rounded-[6px] h-[36px] px-3 pr-8 text-[13px] font-semibold text-[#1f272e] outline-none transition appearance-none cursor-pointer"
                        >
                          <option value="INFORMATION">INFORMATION</option>
                          <option value="TRANSFER">TRANSFER</option>
                          <option value="GRIEVANCES">GRIEVANCES</option>
                        </select>
                        <ChevronsUpDown className="h-3.5 w-3.5 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    </div>

                    {/* Middle: Conditional Fields based on Form Type */}
                    {esicFormData.form === "TRANSFER" ? (
                      /* TRANSFER FORM matching media_1791615825825.png */
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4">
                        <div>
                          <label className="block text-[12px] leading-[1.25] text-[#333e48] font-normal mb-1.5 min-h-[22px] flex items-end">
                            Employer's Details
                          </label>
                          <input
                            type="text"
                            value={esicFormData.transfer_employer_details}
                            onChange={(e) => setEsicFormData({ ...esicFormData, transfer_employer_details: e.target.value })}
                            className="w-full bg-[#f4f5f7] border border-transparent focus:border-[#2563eb] focus:bg-white rounded-[6px] h-[34px] px-3 text-[12.5px] text-[#1f272e] outline-none transition"
                          />
                        </div>

                        <div>
                          <label className="block text-[12px] leading-[1.25] text-[#333e48] font-normal mb-1.5 min-h-[22px] flex items-end">
                            Transfer to
                          </label>
                          <input
                            type="text"
                            value={esicFormData.transfer_to}
                            onChange={(e) => setEsicFormData({ ...esicFormData, transfer_to: e.target.value })}
                            className="w-full bg-[#f4f5f7] border border-transparent focus:border-[#2563eb] focus:bg-white rounded-[6px] h-[34px] px-3 text-[12.5px] text-[#1f272e] outline-none transition"
                          />
                        </div>

                        <div>
                          <label className="block text-[12px] leading-[1.25] text-[#333e48] font-normal mb-1.5 min-h-[22px] flex items-end">
                            Reasons for Transfer
                          </label>
                          <input
                            type="text"
                            value={esicFormData.transfer_reason}
                            onChange={(e) => setEsicFormData({ ...esicFormData, transfer_reason: e.target.value })}
                            placeholder=""
                            className="w-full bg-[#f4f5f7] border border-transparent focus:border-[#2563eb] focus:bg-white rounded-[6px] h-[34px] px-3 text-[12.5px] text-[#1f272e] outline-none transition"
                          />
                        </div>
                      </div>
                    ) : esicFormData.form === "GRIEVANCES" ? (
                      /* GRIEVANCES FORM matching media_1791615872295.png */
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-x-6 gap-y-4">
                        <div>
                          <label className="block text-[12px] leading-[1.25] text-[#333e48] font-normal mb-1.5 min-h-[22px] flex items-end">
                            <span>E-Pehchan Card No <span className="text-red-500 font-bold">*</span></span>
                          </label>
                          <input
                            type="text"
                            value={esicFormData.grievance_card_no}
                            onChange={(e) => {
                              setEsicFormData({ ...esicFormData, grievance_card_no: e.target.value });
                              if (esicFormErrors.grievance_card_no) setEsicFormErrors((prev) => ({ ...prev, grievance_card_no: false }));
                            }}
                            className={`w-full bg-[#f4f5f7] border rounded-[6px] h-[34px] px-3 text-[12.5px] outline-none transition ${
                              esicFormErrors.grievance_card_no ? "border-red-500 bg-red-50 text-red-900" : "border-transparent text-[#1f272e] focus:border-[#2563eb] focus:bg-white"
                            }`}
                          />
                        </div>

                        <div>
                          <label className="block text-[12px] leading-[1.25] text-[#333e48] font-normal mb-1.5 min-h-[22px] flex items-end">
                            <span>Address where currently employed <span className="text-red-500 font-bold">*</span></span>
                          </label>
                          <input
                            type="text"
                            value={esicFormData.grievance_address_employed}
                            onChange={(e) => {
                              setEsicFormData({ ...esicFormData, grievance_address_employed: e.target.value });
                              if (esicFormErrors.grievance_address_employed) setEsicFormErrors((prev) => ({ ...prev, grievance_address_employed: false }));
                            }}
                            className={`w-full bg-[#f4f5f7] border rounded-[6px] h-[34px] px-3 text-[12.5px] outline-none transition ${
                              esicFormErrors.grievance_address_employed ? "border-red-500 bg-red-50 text-red-900" : "border-transparent text-[#1f272e] focus:border-[#2563eb] focus:bg-white"
                            }`}
                          />
                        </div>

                        <div>
                          <label className="block text-[12px] leading-[1.25] text-[#333e48] font-normal mb-1.5 min-h-[22px] flex items-end">
                            <span>Grievance type <span className="text-red-500 font-bold">*</span></span>
                          </label>
                          <select
                            value={esicFormData.grievance_type}
                            onChange={(e) => setEsicFormData({ ...esicFormData, grievance_type: e.target.value })}
                            className="w-full bg-[#f4f5f7] border border-transparent focus:border-[#2563eb] focus:bg-white rounded-[6px] h-[34px] px-3 text-[12.5px] text-[#1f272e] outline-none transition cursor-pointer"
                          >
                            <option value="Facility">Facility</option>
                            <option value="Staff Behavior">Staff Behavior</option>
                            <option value="Medicine Shortage">Medicine Shortage</option>
                            <option value="Reimbursement Delay">Reimbursement Delay</option>
                            <option value="Card Correction">Card Correction</option>
                            <option value="Others">Others</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[12px] leading-[1.25] text-[#333e48] font-normal mb-1.5 min-h-[22px] flex items-end">
                            Others, please mention
                          </label>
                          <input
                            type="text"
                            value={esicFormData.grievance_others}
                            onChange={(e) => setEsicFormData({ ...esicFormData, grievance_others: e.target.value })}
                            className="w-full bg-[#f4f5f7] border border-transparent focus:border-[#2563eb] focus:bg-white rounded-[6px] h-[34px] px-3 text-[12.5px] text-[#1f272e] outline-none transition"
                          />
                        </div>
                      </div>
                    ) : (
                      /* INFORMATION FORM matching media_1791615277370.png */
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-x-6 gap-y-4">
                        {/* Row 1, Col 1 */}
                        <div>
                          <label className="block text-[12px] leading-[1.25] text-[#333e48] font-normal mb-1.5 min-h-[30px] flex items-end">
                            <span>Are you aware of the benefits and services of ESIC? <span className="text-red-500 font-bold">*</span></span>
                          </label>
                          <select
                            value={esicFormData.q_awareness}
                            onChange={(e) => setEsicFormData({ ...esicFormData, q_awareness: e.target.value })}
                            className="w-full bg-[#f4f5f7] border border-transparent focus:border-[#2563eb] focus:bg-white rounded-[6px] h-[34px] px-3 text-[12.5px] text-[#1f272e] outline-none transition cursor-pointer"
                          >
                            <option value="Yes">Yes</option>
                            <option value="No">No</option>
                            <option value="NA">NA</option>
                          </select>
                        </div>

                        {/* Row 1, Col 2 */}
                        <div>
                          <label className="block text-[12px] leading-[1.25] text-[#333e48] font-normal mb-1.5 min-h-[30px] flex items-end">
                            <span>2. What kind of information do you want to know about? <span className="text-red-500 font-bold">*</span></span>
                          </label>
                          <select
                            value={esicFormData.q_info_type}
                            onChange={(e) => setEsicFormData({ ...esicFormData, q_info_type: e.target.value })}
                            className="w-full bg-[#f4f5f7] border border-transparent focus:border-[#2563eb] focus:bg-white rounded-[6px] h-[34px] px-3 text-[12.5px] text-[#1f272e] outline-none transition cursor-pointer"
                          >
                            <option value="1. About ESIS">1. About ESIS</option>
                            <option value="2. Benefits">2. Benefits</option>
                            <option value="3. Claims & Reimbursements">3. Claims & Reimbursements</option>
                            <option value="4. E Pehchan Card Changes">4. E Pehchan Card Changes</option>
                            <option value="5. Others">5. Others</option>
                            <option value="6. NA">6. NA</option>
                          </select>
                        </div>

                        {/* Row 1, Col 3 */}
                        <div>
                          <label className="block text-[12px] leading-[1.25] text-[#333e48] font-normal mb-1.5 min-h-[30px] flex items-end">
                            <span>a) Informed caller about Coverage & Eligibility of Scheme?</span>
                          </label>
                          <select
                            value={esicFormData.q_coverage}
                            onChange={(e) => setEsicFormData({ ...esicFormData, q_coverage: e.target.value })}
                            className="w-full bg-[#f4f5f7] border border-transparent focus:border-[#2563eb] focus:bg-white rounded-[6px] h-[34px] px-3 text-[12.5px] text-[#1f272e] outline-none transition cursor-pointer"
                          >
                            <option value="Yes">Yes</option>
                            <option value="No">No</option>
                          </select>
                        </div>

                        {/* Row 1, Col 4 */}
                        <div>
                          <label className="block text-[12px] leading-[1.25] text-[#333e48] font-normal mb-1.5 min-h-[30px] flex items-end">
                            <span>3. Benefit types</span>
                          </label>
                          <select
                            value={esicFormData.q_benefit_type}
                            onChange={(e) => setEsicFormData({ ...esicFormData, q_benefit_type: e.target.value })}
                            className="w-full bg-[#f4f5f7] border border-transparent focus:border-[#2563eb] focus:bg-white rounded-[6px] h-[34px] px-3 text-[12.5px] text-[#1f272e] outline-none transition cursor-pointer"
                          >
                            <option value="Medical Benefits">Medical Benefits</option>
                            <option value="Maternity Benefits">Maternity Benefits</option>
                            <option value="Sickness Benefits">Sickness Benefits</option>
                            <option value="Disablement Benefits">Disablement Benefits</option>
                            <option value="Dependent Benefits">Dependent Benefits</option>
                            <option value="Need Based Benefits">Need Based Benefits</option>
                            <option value="Funeral Benefits">Funeral Benefits</option>
                            <option value="Others">Others</option>
                            <option value="NA">NA</option>
                          </select>
                        </div>

                        {/* Row 2, Col 1 */}
                        <div>
                          <label className="block text-[12px] leading-[1.25] text-[#333e48] font-normal mb-1.5 min-h-[30px] flex items-end">
                            <span>3.1 Describe, if others.</span>
                          </label>
                          <input
                            type="text"
                            value={esicFormData.q_benefit_others}
                            onChange={(e) => setEsicFormData({ ...esicFormData, q_benefit_others: e.target.value })}
                            className="w-full bg-[#f4f5f7] border border-transparent focus:border-[#2563eb] focus:bg-white rounded-[6px] h-[34px] px-3 text-[12.5px] text-[#1f272e] outline-none transition"
                          />
                        </div>

                        {/* Row 2, Col 2 */}
                        <div>
                          <label className="block text-[12px] leading-[1.25] text-[#333e48] font-normal mb-1.5 min-h-[30px] flex items-end">
                            <span>b) Informed caller about claims?</span>
                          </label>
                          <select
                            value={esicFormData.q_claims}
                            onChange={(e) => setEsicFormData({ ...esicFormData, q_claims: e.target.value })}
                            className="w-full bg-[#f4f5f7] border border-transparent focus:border-[#2563eb] focus:bg-white rounded-[6px] h-[34px] px-3 text-[12.5px] text-[#1f272e] outline-none transition cursor-pointer"
                          >
                            <option value="Yes">Yes</option>
                            <option value="No">No</option>
                          </select>
                        </div>

                        {/* Row 2, Col 3 */}
                        <div>
                          <label className="block text-[12px] leading-[1.25] text-[#333e48] font-normal mb-1.5 min-h-[30px] flex items-end">
                            <span>c) Informed caller about reimbursements?</span>
                          </label>
                          <select
                            value={esicFormData.q_reimbursements}
                            onChange={(e) => setEsicFormData({ ...esicFormData, q_reimbursements: e.target.value })}
                            className="w-full bg-[#f4f5f7] border border-transparent focus:border-[#2563eb] focus:bg-white rounded-[6px] h-[34px] px-3 text-[12.5px] text-[#1f272e] outline-none transition cursor-pointer"
                          >
                            <option value="Yes">Yes</option>
                            <option value="No">No</option>
                          </select>
                        </div>

                        {/* Row 2, Col 4 */}
                        <div>
                          <label className="block text-[12px] leading-[1.25] text-[#333e48] font-normal mb-1.5 min-h-[30px] flex items-end">
                            <span>4. E Pehchan Card Changes?</span>
                          </label>
                          <select
                            value={esicFormData.q_card_changes}
                            onChange={(e) => setEsicFormData({ ...esicFormData, q_card_changes: e.target.value })}
                            className="w-full bg-[#f4f5f7] border border-transparent focus:border-[#2563eb] focus:bg-white rounded-[6px] h-[34px] px-3 text-[12.5px] text-[#1f272e] outline-none transition cursor-pointer"
                          >
                            <option value="Name correction">Name correction</option>
                            <option value="Correction of Marital Status">Correction of Marital Status</option>
                            <option value="Address Change/correct">Address Change/correct</option>
                            <option value="Ph. No. update/ correct">Ph. No. update/ correct</option>
                            <option value="Adding Dependent's">Adding Dependent's</option>
                            <option value="Dispensary change">Dispensary change</option>
                            <option value="Others">Others</option>
                            <option value="NA">NA</option>
                          </select>
                        </div>

                        {/* Row 3, Col 1 */}
                        <div>
                          <label className="block text-[12px] leading-[1.25] text-[#333e48] font-normal mb-1.5 min-h-[30px] flex items-end">
                            <span>4.1 If others, please specify</span>
                          </label>
                          <input
                            type="text"
                            value={esicFormData.q_card_others}
                            onChange={(e) => setEsicFormData({ ...esicFormData, q_card_others: e.target.value })}
                            className="w-full bg-[#f4f5f7] border border-transparent focus:border-[#2563eb] focus:bg-white rounded-[6px] h-[34px] px-3 text-[12.5px] text-[#1f272e] outline-none transition"
                          />
                        </div>

                        {/* Row 3, Col 2 */}
                        <div>
                          <label className="block text-[12px] leading-[1.25] text-[#333e48] font-normal mb-1.5 min-h-[30px] flex items-end">
                            <span>Follow up required? <span className="text-red-500 font-bold">*</span></span>
                          </label>
                          <select
                            value={esicFormData.q_followup}
                            onChange={(e) => setEsicFormData({ ...esicFormData, q_followup: e.target.value })}
                            className="w-full bg-[#f4f5f7] border border-transparent focus:border-[#2563eb] focus:bg-white rounded-[6px] h-[34px] px-3 text-[12.5px] text-[#1f272e] outline-none transition cursor-pointer"
                          >
                            <option value="Yes">Yes</option>
                            <option value="No">No</option>
                          </select>
                        </div>

                        {/* Row 3, Col 3 */}
                        <div>
                          <label className="block text-[12px] leading-[1.25] text-[#333e48] font-normal mb-1.5 min-h-[30px] flex items-end">
                            <span>Based on the quality of call, how would you rate us? <span className="text-red-500 font-bold">*</span></span>
                          </label>
                          <select
                            value={esicFormData.q_rating}
                            onChange={(e) => setEsicFormData({ ...esicFormData, q_rating: e.target.value })}
                            className="w-full bg-[#f4f5f7] border border-transparent focus:border-[#2563eb] focus:bg-white rounded-[6px] h-[34px] px-3 text-[12.5px] text-[#1f272e] outline-none transition cursor-pointer"
                          >
                            <option value="0">0</option>
                            <option value="1">1</option>
                            <option value="2">2</option>
                            <option value="3">3</option>
                            <option value="4">4</option>
                            <option value="5">5</option>
                          </select>
                        </div>

                        {/* Row 3, Col 4 (blank space to match layout) */}
                        <div className="hidden md:block"></div>
                      </div>
                    )}

                    {/* Bottom: Call Details in 4 Columns */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-x-6 gap-y-4 mt-8">
                      {/* Col 1: Next Follow-up */}
                      <div>
                        <label className="block text-[12px] text-[#333e48] font-normal mb-1.5">
                          Next Follow-up
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            value={esicFormData.next_followup}
                            onChange={(e) => setEsicFormData({ ...esicFormData, next_followup: e.target.value })}
                            placeholder="dd-mm-yyyy"
                            className="w-full bg-[#f4f5f7] border border-transparent focus:border-[#2563eb] focus:bg-white rounded-[6px] h-[34px] px-3 pr-8 text-[12.5px] text-[#1f272e] placeholder-[#8b9aa8] outline-none transition"
                          />
                          <Calendar className="h-3.5 w-3.5 text-[#556370] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                      </div>

                      {/* Col 2: Call Type * (Must be selected to save) */}
                      <div>
                        <label className="block text-[12px] text-[#333e48] font-normal mb-1.5">
                          Call Type <span className="text-red-500 font-bold">*</span>
                        </label>
                        <select
                          value={esicFormData.call_type}
                          onChange={(e) => {
                            setEsicFormData({ ...esicFormData, call_type: e.target.value });
                            if (esicFormErrors.call_type) setEsicFormErrors((prev) => ({ ...prev, call_type: false }));
                          }}
                          className={`w-full bg-[#f4f5f7] border rounded-[6px] h-[34px] px-3 text-[12.5px] outline-none transition cursor-pointer ${
                            esicFormErrors.call_type
                              ? "border-red-500 bg-red-50 text-red-900"
                              : !esicFormData.call_type
                              ? "border-transparent text-[#7b8997] focus:border-[#2563eb] focus:bg-white focus:text-[#1f272e]"
                              : "border-transparent text-[#1f272e] focus:border-[#2563eb] focus:bg-white"
                          }`}
                        >
                          <option value="">Select Call Type</option>
                          <option value="Outbound">Outbound</option>
                          <option value="Inbound">Inbound</option>
                          <option value="Transfer">Transfer</option>
                        </select>
                      </div>

                      {/* Col 3: Category * */}
                      <div>
                        <label className="block text-[12px] text-[#333e48] font-normal mb-1.5">
                          Category <span className="text-red-500 font-bold">*</span>
                        </label>
                        <select
                          value={esicFormData.category}
                          onChange={(e) => {
                            setEsicFormData({ ...esicFormData, category: e.target.value });
                            if (esicFormErrors.category) setEsicFormErrors((prev) => ({ ...prev, category: false }));
                          }}
                          className={`w-full bg-[#f4f5f7] border rounded-[6px] h-[34px] px-3 text-[12.5px] outline-none transition cursor-pointer ${
                            esicFormErrors.category
                              ? "border-red-500 bg-red-50 text-red-900"
                              : !esicFormData.category
                              ? "border-transparent text-[#7b8997] focus:border-[#2563eb] focus:bg-white focus:text-[#1f272e]"
                              : "border-transparent text-[#1f272e] focus:border-[#2563eb] focus:bg-white"
                          }`}
                        >
                          <option value="">Select Category</option>
                          <option value="Not connected">Not connected</option>
                          <option value="Connected">Connected</option>
                          <option value="Information">Information</option>
                          <option value="Grievances">Grievances</option>
                          <option value="Transfer">Transfer</option>
                          <option value="Inquiry">Inquiry</option>
                        </select>
                      </div>

                      {/* Col 4: Sub Category * */}
                      <div>
                        <label className="block text-[12px] text-[#333e48] font-normal mb-1.5">
                          Sub Category <span className="text-red-500 font-bold">*</span>
                        </label>
                        <select
                          value={esicFormData.sub_category}
                          onChange={(e) => {
                            setEsicFormData({ ...esicFormData, sub_category: e.target.value });
                            if (esicFormErrors.sub_category) setEsicFormErrors((prev) => ({ ...prev, sub_category: false }));
                          }}
                          className={`w-full bg-[#f4f5f7] border rounded-[6px] h-[34px] px-3 text-[12.5px] outline-none transition cursor-pointer ${
                            esicFormErrors.sub_category
                              ? "border-red-500 bg-red-50 text-red-900"
                              : !esicFormData.sub_category
                              ? "border-transparent text-[#7b8997] focus:border-[#2563eb] focus:bg-white focus:text-[#1f272e]"
                              : "border-transparent text-[#1f272e] focus:border-[#2563eb] focus:bg-white"
                          }`}
                        >
                          <option value="">Select Sub Category</option>
                          <option value="Not Answered">Not Answered</option>
                          <option value="Answered">Answered</option>
                          <option value="Busy / Call Waiting">Busy / Call Waiting</option>
                          <option value="Switched Off">Switched Off</option>
                          <option value="General">General</option>
                          <option value="Hospital">Hospital</option>
                          <option value="Card">Card</option>
                          <option value="Scheme">Scheme</option>
                        </select>
                      </div>
                    </div>

                    {/* Single Save Button in Bottom Right matching media_1791484537132.png */}
                    <div className="mt-8 mb-2 flex justify-end">
                      <button
                        type="submit"
                        className="px-5 py-1.5 bg-[#1a385c] hover:bg-[#132c49] text-white font-medium text-[13px] rounded-[6px] transition cursor-pointer shadow-xs active:scale-95"
                      >
                        Save
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* ================= INBOUND TRIAGE FORM MODAL ================= */}
            {inboundTriageModalOpen && (
              <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-2xs flex items-center justify-center p-2 sm:p-4">
                <div className="bg-white rounded-xl shadow-2xl w-full h-[95vh] max-w-[1550px] border border-slate-300 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                  {/* Modal Header */}
                  <div className="px-5 py-3 border-b border-slate-200 bg-[#f8fafc] flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-sm">
                        <Stethoscope className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-[#1f272e] text-[16px]">Inbound Triage Consultation Form</h3>
                        <div className="flex flex-wrap items-center gap-1.5 text-[12px] text-slate-600 font-medium mt-0.5">
                          <span>Beneficiary:</span>
                          <strong className="text-slate-800 font-semibold">
                            {`${beneficiaryData.firstName || ""} ${beneficiaryData.lastName || ""}`.trim() || beneficiaryData.fullName || beneficiaryData.name || "Beneficiary"}
                          </strong>
                          <span>, {beneficiaryData.age || 33}y · {beneficiaryData.gender || "Male"}, {(beneficiaryData.phoneNumber ? beneficiaryData.phoneNumber.replace(/\D/g, "").slice(-10) : "7845125874")}</span>
                          {(() => {
                            const place = (
                              beneficiaryData.addressLine1 ||
                              beneficiaryData.addressLine2 ||
                              beneficiaryData.village ||
                              beneficiaryData.block ||
                              ""
                            ).trim();
                            const district = (beneficiaryData.district || "").trim();
                            const pin = (beneficiaryData.pinCode || "").trim();

                            const validPlace = place && place.toLowerCase() !== "place" ? place : "";
                            const validDistrict = district && district.toLowerCase() !== "district" ? district : "";
                            const validPin = pin && pin.toLowerCase() !== "pincode" ? pin : "";

                            const parts = [];
                            if (validPlace) parts.push(validPlace);
                            if (validDistrict) parts.push(validDistrict);
                            if (validPin) parts.push(validPin);

                            if (parts.length === 0) return null;
                            return ` • Address: ${parts.join(", ")}`;
                          })()}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleResetInboundChat}
                        className="text-slate-600 hover:text-blue-700 bg-slate-100 hover:bg-blue-50 border border-slate-200 px-2.5 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 text-xs font-semibold shadow-xs"
                        title="Reset whole chat (Start fresh conversation)"
                      >
                        <RotateCcw className="h-3.5 w-3.5 text-blue-600" />
                        <span>Reset Chat</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleCloseInboundTriageModal}
                        className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-200 transition cursor-pointer"
                        title="Close Form"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                  </div>

                  {/* Modal Split Body: Left 50% Triage Chat Box, Right 50% Outcomes */}
                  <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 overflow-hidden bg-slate-50 min-h-0">
                    {/* LEFT HALF: Triage AI Chat Box with Call History available on scroll */}
                    <div className="flex flex-col h-full bg-white overflow-y-auto min-h-0">
                      {/* Top Screen: Full-height Chat Box + Run Triage Action Bar */}
                      <div className="min-h-full flex flex-col shrink-0">
                        <div className="flex-1 min-h-0 p-2 sm:p-3 overflow-hidden flex flex-col">
                          <EkmsAiChatArea
                            ref={triageChatRef}
                            title="Triage Consultation AI Chat"
                            chatSessionKey={`crm_triage_chat_${beneficiaryData.beneficiaryId || "session"}`}
                            currentAgent={{ agentId: activeAgentId }}
                            initialNotes=""
                            triageResult={triageOutcome}
                            activeDirective={triageActiveDirective}
                            fillHeight={true}
                            onComplaintChange={(compiledNotes, ctx) => {
                              setTriageNotes(compiledNotes);
                              setEkmsContext(ctx);
                              setTriageOutcome((prev) => {
                                if (!prev) return prev;
                                return {
                                  ...prev,
                                  ekms_ai_context: ctx,
                                  intake: {
                                    ...(prev.intake || {}),
                                    symptom_notes: compiledNotes,
                                  },
                                };
                              });
                            }}
                            onSyncFields={() => {}}
                            onReadyToShowResult={() => {}}
                            onRunTriage={(overrideCtx) => {
                              handleRunInboundTriage(overrideCtx);
                            }}
                          />
                        </div>

                        {/* Bottom Run Triage Action Bar */}
                        <div className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-t border-blue-100 flex items-center justify-between gap-3 shrink-0">
                          <span className="text-[12px] sm:text-[12.5px] text-slate-600 font-medium leading-snug">
                            To Evaluate the urgency and referral facility click run triage button
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRunInboundTriage()}
                            disabled={triageLoading}
                            className="px-6 py-2.5 bg-blue-700 hover:bg-blue-800 text-white font-bold text-[13px] rounded-lg shadow-md flex items-center gap-2 cursor-pointer transition active:scale-95 disabled:opacity-50 shrink-0"
                          >
                            {triageLoading ? (
                              <>
                                <RefreshCw className="h-4 w-4 animate-spin" />
                                <span>Evaluating Clinical AI...</span>
                              </>
                            ) : (
                              <>
                                <Sparkles className="h-4 w-4 text-amber-300" />
                                <span>Run Triage</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Bottom Section: Caller Call History (revealed upon scrolling) */}
                      <div className="w-full p-2.5 sm:p-4 bg-slate-50 border-t border-slate-200">
                        <CallerHistorySection
                          form={{
                            caller_name: `${beneficiaryData.firstName || ""} ${beneficiaryData.lastName || ""}`.trim() || beneficiaryData.fullName || beneficiaryData.name || "Beneficiary",
                            phone: (beneficiaryData.phoneNumber ? beneficiaryData.phoneNumber.replace(/\D/g, "").slice(-10) : "") || "6002283107",
                            age: beneficiaryData.age || "33",
                            sex: beneficiaryData.gender || "Male",
                            district: beneficiaryData.district || "",
                            pincode: beneficiaryData.pinCode || "",
                            symptom_notes: triageNotes || "",
                          }}
                          callerHistory={crmOnlyCallHistory}
                          currentAgent={{ agentId: activeAgentId || "Agent 1" }}
                          activeCallerId={beneficiaryData.beneficiaryId || beneficiaryData.id || "261008-41439"}
                          activeCaseRef={inboundTriageModalOpen ? (activeTriageCaseRef || triageOutcome?.case_ref) : null}
                        />
                      </div>
                    </div>

                    {/* RIGHT HALF: Triage Outcomes */}
                    <div className="flex flex-col h-full bg-[#f8fafc] overflow-hidden">
                      {/* Outcome Content Scrollable */}
                      <div className="flex-1 overflow-y-auto p-3 sm:p-4">
                        <TriageResultPanel
                          result={triageOutcome}
                          loading={triageLoading}
                          callerIntake={triageCallerIntake}
                          currentAgent={{ agentId: activeAgentId }}
                          onDirectiveChange={setTriageActiveDirective}
                          callerHistory={crmOnlyCallHistory}
                          caseRef={activeTriageCaseRef || triageOutcome?.case_ref}
                          isFreshTriage={true}
                          isCrmPage={true}
                          onForwardSuccess={(statusData) => {
                            const facilityName = statusData?.facilityName || statusData?.teamName || "Forwarded";
                            const refNo = statusData?.dispatchId || statusData?.referenceNo || "";
                            const bookingStr = statusData?.appointment_date
                              ? `${facilityName} - ${statusData.appointment_date}${statusData.appointment_time ? ` (${statusData.appointment_time})` : ""}`
                              : "";
                            setTriageOutcome((prev) => {
                              const base = prev || {};
                              const updatedOutcome = {
                                ...base,
                                is_forwarded: true,
                                forwarded_at: statusData?.timestamp || new Date().toISOString(),
                                dispatch_id: refNo,
                                reference_no: refNo,
                                forwarded_to: facilityName,
                                forwarded_facility_name: facilityName,
                                forwarded_short_name: statusData?.shortName,
                                status: "forwarded",
                                dispatch_info: statusData,
                                booking: bookingStr || base.booking || "",
                                _cachedAt: Date.now(),
                                cachedAt: Date.now(),
                                triage: {
                                  ...(base.triage || {}),
                                  forwarded_to: facilityName,
                                  call_referral_primary: facilityName,
                                  referral_destination: facilityName,
                                },
                              };
                              try {
                                const benId = beneficiaryData.beneficiaryId || "session";
                                sessionStorage.setItem(`crm_triage_outcome_${benId}`, JSON.stringify(updatedOutcome));
                                localStorage.setItem(`crm_triage_outcome_${benId}`, JSON.stringify(updatedOutcome));
                              } catch (_) {}
                              return updatedOutcome;
                            });

                            let updatedSurveyEntry = null;
                            const aiPrimary = (
                              triageOutcome?.triage?.call_referral_primary ||
                              triageOutcome?.triage?.referral_destination ||
                              triageOutcome?.triage?.recommended_facility_type ||
                              "104 Health Helpline"
                            ).toLowerCase();
                            const isSameAsAi =
                              (facilityName.toLowerCase().includes("104") && aiPrimary.includes("104")) ||
                              (facilityName.toLowerCase().includes("108") && aiPrimary.includes("108")) ||
                              facilityName.toLowerCase().trim() === aiPrimary.trim();
                            const effectiveAgentFacility = isSameAsAi ? "" : facilityName;

                            setSurveyHistory((prev) => {
                              const updated = prev.map((s, idx) => {
                                if (idx === 0 && s.campaign === "Inbound Triage") {
                                  let hasRefNo = false;
                                  const nextResp = (s.details?.responses || []).map((r) => {
                                    if (r.q === "Recommended Facility by Agent" || r.q === "Recommended Facility") {
                                      return { q: "Recommended Facility by Agent", a: effectiveAgentFacility };
                                    }
                                    if (r.q === "Booking") {
                                      return { ...r, a: bookingStr || r.a || "" };
                                    }
                                    if (r.q === "Reference No") {
                                      hasRefNo = true;
                                      return { ...r, a: refNo };
                                    }
                                    return r;
                                  });
                                  if (!hasRefNo && refNo) {
                                    const bIdx = nextResp.findIndex((r) => r.q === "Booking");
                                    if (bIdx !== -1) {
                                      nextResp.splice(bIdx + 1, 0, { q: "Reference No", a: refNo });
                                    } else {
                                      nextResp.push({ q: "Reference No", a: refNo });
                                    }
                                  }
                                  const updatedItem = {
                                    ...s,
                                    details: {
                                      ...s.details,
                                      callType: "",
                                      category: "",
                                      subCategory: "",
                                      agentFacility: effectiveAgentFacility,
                                      booking: bookingStr || s.details?.booking || "",
                                      referenceNo: refNo,
                                      responses: nextResp,
                                    },
                                  };
                                  updatedSurveyEntry = updatedItem;
                                  return updatedItem;
                                }
                                return s;
                              });
                              try {
                                localStorage.setItem(`crm_surveys_ben_${beneficiaryData.beneficiaryId}`, JSON.stringify(updated));
                                if (updatedSurveyEntry) {
                                  const crmDb = getCrmFirestoreDb();
                                  if (crmDb) {
                                    setDoc(doc(crmDb, "crm_surveys", String(updatedSurveyEntry.id)), updatedSurveyEntry).catch(() => {});
                                  }
                                }
                              } catch (_) {}
                              return updated;
                            });

                            // Also sync updated record into crm_inbound_triage_reports
                            try {
                              const benId = beneficiaryData.beneficiaryId;
                              const existingReports = JSON.parse(localStorage.getItem("crm_inbound_triage_reports") || "[]");
                              let syncedReport = null;
                              const updatedReports = existingReports.map((r, idx) => {
                                if ((r.beneficiaryId === benId && r.campaign === "Inbound Triage") || idx === 0) {
                                  let hasRefNo = false;
                                  const nextResp = (r.details?.responses || []).map((resp) => {
                                    if (resp.q === "Recommended Facility by Agent" || resp.q === "Recommended Facility") {
                                      return { q: "Recommended Facility by Agent", a: facilityName };
                                    }
                                    if (resp.q === "Booking") return { ...resp, a: bookingStr || resp.a || "" };
                                    if (resp.q === "Reference No") {
                                      hasRefNo = true;
                                      return { ...resp, a: refNo };
                                    }
                                    return resp;
                                  });
                                  if (!hasRefNo && refNo) {
                                    const bIdx = nextResp.findIndex((resp) => resp.q === "Booking");
                                    if (bIdx !== -1) {
                                      nextResp.splice(bIdx + 1, 0, { q: "Reference No", a: refNo });
                                    } else {
                                      nextResp.push({ q: "Reference No", a: refNo });
                                    }
                                  }
                                  const rep = {
                                    ...r,
                                    details: {
                                      ...r.details,
                                      callType: "",
                                      category: "",
                                      subCategory: "",
                                      agentFacility: facilityName,
                                      booking: bookingStr || r.details?.booking || "",
                                      referenceNo: refNo,
                                      responses: nextResp,
                                    },
                                  };
                                  syncedReport = rep;
                                  return rep;
                                }
                                return r;
                              });
                              localStorage.setItem("crm_inbound_triage_reports", JSON.stringify(updatedReports));
                              setTriageReportsList(updatedReports);
                              if (syncedReport) {
                                const crmDb = getCrmFirestoreDb();
                                if (crmDb) {
                                  setDoc(doc(crmDb, "crm_inbound_triage_reports", String(syncedReport.id)), syncedReport).catch(() => {});
                                }
                              }
                            } catch (_) {}
                          }}
                          onAppointmentBooked={(bookingData) => {
                            const facilityName = bookingData?.facilityName || "";
                            const refNo = bookingData?.referenceNo || bookingData?.tokenNo || "";
                            const bookingDate = bookingData?.date || "";
                            const bookingSlot = bookingData?.timeSlot || "";
                            const bookingStr = facilityName && bookingDate
                              ? `${facilityName} - ${bookingDate}${bookingSlot ? ` (${bookingSlot})` : ""}`
                              : "";

                            setTriageOutcome((prev) => {
                              const base = prev || {};
                              const updatedOutcome = {
                                ...base,
                                booked_appointment: bookingData,
                                dispatch_id: refNo || base.dispatch_id,
                                reference_no: refNo || base.reference_no,
                                booking: bookingStr || base.booking || "",
                                forwarded_facility_name: facilityName || base.forwarded_facility_name,
                                forwarded_to: facilityName || base.forwarded_to,
                                _cachedAt: Date.now(),
                                cachedAt: Date.now(),
                              };
                              try {
                                const benId = beneficiaryData.beneficiaryId || "session";
                                sessionStorage.setItem(`crm_triage_outcome_${benId}`, JSON.stringify(updatedOutcome));
                                localStorage.setItem(`crm_triage_outcome_${benId}`, JSON.stringify(updatedOutcome));
                              } catch (_) {}
                              return updatedOutcome;
                            });

                            let updatedSurveyEntry = null;
                            setSurveyHistory((prev) => {
                              const updated = prev.map((s, idx) => {
                                if (idx === 0 && s.campaign === "Inbound Triage") {
                                  let hasRefNo = false;
                                  const nextResp = (s.details?.responses || []).map((r) => {
                                    if (r.q === "Recommended Facility by Agent" || r.q === "Recommended Facility") {
                                      return { q: "Recommended Facility by Agent", a: facilityName || r.a };
                                    }
                                    if (r.q === "Booking") {
                                      return { ...r, a: bookingStr || r.a || "" };
                                    }
                                    if (r.q === "Reference No") {
                                      hasRefNo = true;
                                      return { ...r, a: refNo || r.a };
                                    }
                                    return r;
                                  });
                                  if (!hasRefNo && refNo) {
                                    const bIdx = nextResp.findIndex((r) => r.q === "Booking");
                                    if (bIdx !== -1) {
                                      nextResp.splice(bIdx + 1, 0, { q: "Reference No", a: refNo });
                                    } else {
                                      nextResp.push({ q: "Reference No", a: refNo });
                                    }
                                  }
                                  const updatedItem = {
                                    ...s,
                                    details: {
                                      ...s.details,
                                      callType: "",
                                      category: "",
                                      subCategory: "",
                                      agentFacility: facilityName || s.details?.agentFacility,
                                      booking: bookingStr || s.details?.booking || "",
                                      referenceNo: refNo || s.details?.referenceNo,
                                      responses: nextResp,
                                    },
                                  };
                                  updatedSurveyEntry = updatedItem;
                                  return updatedItem;
                                }
                                return s;
                              });
                              try {
                                localStorage.setItem(`crm_surveys_ben_${beneficiaryData.beneficiaryId}`, JSON.stringify(updated));
                                if (updatedSurveyEntry) {
                                  const crmDb = getCrmFirestoreDb();
                                  if (crmDb) {
                                    setDoc(doc(crmDb, "crm_surveys", String(updatedSurveyEntry.id)), updatedSurveyEntry).catch(() => {});
                                  }
                                }
                              } catch (_) {}
                              return updated;
                            });

                            try {
                              const benId = beneficiaryData.beneficiaryId;
                              const existingReports = JSON.parse(localStorage.getItem("crm_inbound_triage_reports") || "[]");
                              let syncedReport = null;
                              const updatedReports = existingReports.map((r, idx) => {
                                if ((r.beneficiaryId === benId && r.campaign === "Inbound Triage") || idx === 0) {
                                  let hasRefNo = false;
                                  const nextResp = (r.details?.responses || []).map((resp) => {
                                    if (resp.q === "Recommended Facility by Agent" || resp.q === "Recommended Facility") {
                                      return { q: "Recommended Facility by Agent", a: facilityName || resp.a };
                                    }
                                    if (resp.q === "Booking") return { ...resp, a: bookingStr || resp.a || "" };
                                    if (resp.q === "Reference No") {
                                      hasRefNo = true;
                                      return { ...resp, a: refNo || resp.a };
                                    }
                                    return resp;
                                  });
                                  if (!hasRefNo && refNo) {
                                    const bIdx = nextResp.findIndex((resp) => resp.q === "Booking");
                                    if (bIdx !== -1) {
                                      nextResp.splice(bIdx + 1, 0, { q: "Reference No", a: refNo });
                                    } else {
                                      nextResp.push({ q: "Reference No", a: refNo });
                                    }
                                  }
                                  const rep = {
                                    ...r,
                                    details: {
                                      ...r.details,
                                      callType: "",
                                      category: "",
                                      subCategory: "",
                                      agentFacility: facilityName || r.details?.agentFacility,
                                      booking: bookingStr || r.details?.booking || "",
                                      referenceNo: refNo || r.details?.referenceNo,
                                      responses: nextResp,
                                    },
                                  };
                                  syncedReport = rep;
                                  return rep;
                                }
                                return r;
                              });
                              localStorage.setItem("crm_inbound_triage_reports", JSON.stringify(updatedReports));
                              setTriageReportsList(updatedReports);
                              if (syncedReport) {
                                const crmDb = getCrmFirestoreDb();
                                if (crmDb) {
                                  setDoc(doc(crmDb, "crm_inbound_triage_reports", String(syncedReport.id)), syncedReport).catch(() => {});
                                }
                              }
                            } catch (_) {}
                          }}
                        />
                      </div>

                      {/* Bottom Status Indicator (Auto-Saved upon clicking Run Triage) */}
                      {triageOutcome && (
                        <div className="p-2.5 px-4 bg-emerald-50 border-t border-emerald-200 flex items-center justify-between shrink-0 text-emerald-800 text-[12px] font-medium">
                          <span className="flex items-center gap-1.5">
                            <Check className="h-4 w-4 text-emerald-600" />
                            <span>Triage evaluated & automatically saved to Beneficiary Call History</span>
                          </span>
                          <span className="text-emerald-700 font-semibold">{triageOutcome.triage?.urgency_level || "Triaged"}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
            </main>
          )
        )}

        {/* ================= RIGHT "FILTER BY" PANEL (on Task List, Campaigns, & Beneficiary List) ================= */}
        {(activeNav === "Task List" || activeNav === "Campaigns" || (activeNav === "Beneficiary" && beneficiaryViewMode === "list")) && (
          <aside className="w-[190px] border-l border-[#f1f3f5] bg-white p-4 flex flex-col gap-3.5 shrink-0 text-[12px]">
            <div className="flex items-center gap-1.5 text-[13px] font-semibold text-[#1f272e] cursor-pointer">
              <ChevronDown className="h-3.5 w-3.5 text-[#556370]" />
              <span>Filter By</span>
            </div>

            <div className="flex items-center justify-between px-2.5 py-1.5 bg-[#f6f7f8] hover:bg-[#eff2f5] border border-[#dce2e8] rounded text-[#4b5866] cursor-pointer transition">
              <span>Assigned To</span>
              <ChevronsUpDown className="h-3 w-3 text-[#7b8997]" />
            </div>

            <div className="flex items-center justify-between px-2.5 py-1.5 bg-[#f6f7f8] hover:bg-[#eff2f5] border border-[#dce2e8] rounded text-[#4b5866] cursor-pointer transition">
              <span>Created By</span>
              <ChevronsUpDown className="h-3 w-3 text-[#7b8997]" />
            </div>

            <div className="flex items-center justify-between px-2.5 py-1.5 bg-[#f6f7f8] hover:bg-[#eff2f5] border border-[#dce2e8] rounded text-[#4b5866] cursor-pointer transition">
              <span>District</span>
              <ChevronsUpDown className="h-3 w-3 text-[#7b8997]" />
            </div>

            <div className="text-[12px] text-[#556370] hover:text-[#1f272e] cursor-pointer transition font-normal pt-0.5">
              Edit Filters
            </div>

            <div>
              <div
                onClick={() => setTagsExpanded((prev) => !prev)}
                className="flex items-center gap-1.5 text-[12px] text-[#4b5866] hover:text-[#1f272e] cursor-pointer transition pt-1"
              >
                <ChevronRight
                  className={`h-3 w-3 text-[#7b8997] transition-transform ${tagsExpanded ? "rotate-90" : ""}`}
                />
                <span>Tags</span>
              </div>
              {tagsExpanded && (
                <div className="pl-4 pt-1 text-[11px] text-[#7b8997] space-y-1">
                  <div className="hover:text-[#1f272e] cursor-pointer">Follow-up Needed</div>
                  <div className="hover:text-[#1f272e] cursor-pointer">High Priority</div>
                </div>
              )}
            </div>

            <div>
              <div
                onClick={() => setSavedFiltersExpanded((prev) => !prev)}
                className="flex items-center gap-1.5 text-[12px] text-[#4b5866] hover:text-[#1f272e] cursor-pointer transition"
              >
                <ChevronRight
                  className={`h-3 w-3 text-[#7b8997] transition-transform ${savedFiltersExpanded ? "rotate-90" : ""}`}
                />
                <span>Saved Filters</span>
              </div>
              {savedFiltersExpanded && (
                <div className="pl-4 pt-1 text-[11px] text-[#7b8997] space-y-1">
                  <div className="hover:text-[#1f272e] cursor-pointer">Assigned to Me</div>
                  <div className="hover:text-[#1f272e] cursor-pointer">Delayed Cases</div>
                </div>
              )}
            </div>
          </aside>
        )}

      {/* Floating Bottom-Right Call Icon Button (matching media_1791448189089.png) */}
      <button
        type="button"
        onClick={() => {
          if (!czBarOpen) {
            setCzBarOpen(true);
            setCzBarMinimized(false);
          } else if (czBarMinimized) {
            setCzBarMinimized(false);
          } else {
            setCzBarMinimized(true);
          }
        }}
        className="fixed bottom-5 right-6 z-[99999] w-[50px] h-[50px] rounded-full bg-[#2563eb] hover:bg-[#1d4ed8] text-white flex items-center justify-center shadow-2xl hover:scale-105 active:scale-95 transition-all duration-150 cursor-pointer group"
        title="CZ-Bar"
      >
        {/* Coral/pink phone receiver with tilt matching Waiting for Call */}
        <Phone className="h-6 w-6 text-[#f43f5e] fill-[#f43f5e] drop-shadow-sm" />
      </button>

      {/* Minimized CZ-Bar Pill Bar - Draggable & Opens Big on Click */}
      {czBarMinimized && (
        <div
          onMouseDown={handleCzPillMouseDown}
          onTouchStart={handleCzPillTouchStart}
          onClick={() => {
            if (!czPillDragRef.current.moved) {
              setCzBarMinimized(false);
              setCzBarOpen(true);
            }
          }}
          style={
            czPillPosition.x !== null && czPillPosition.y !== null
              ? {
                  position: "fixed",
                  left: `${czPillPosition.x}px`,
                  top: `${czPillPosition.y}px`,
                  zIndex: 99999,
                  cursor: czPillDragging ? "grabbing" : "grab",
                }
              : undefined
          }
          className={`${
            czPillPosition.x === null ? "fixed bottom-5 right-20 z-50 cursor-grab active:cursor-grabbing" : ""
          } flex items-center justify-between bg-[#1e60d5] hover:bg-[#1952be] text-white px-3.5 py-1.5 rounded-lg shadow-2xl border border-[#1e60d5] select-none min-w-[170px] transition-colors active:scale-98`}
          title="Click to open CZ-Bar • Drag to move"
        >
          <span className="text-[13px] font-semibold tracking-wide pointer-events-none">
            CZ-Bar
          </span>
          <div className="flex items-center gap-2.5 ml-3">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setCzBarMinimized(false);
                setCzBarOpen(true);
              }}
              className="hover:bg-white/20 p-1 rounded transition cursor-pointer text-white flex items-center justify-center"
              title="Open CZ-Bar Big"
            >
              <ArrowUpRight className="h-3.5 w-3.5 stroke-[2.5]" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setCzBarMinimized(false);
                setCzBarOpen(false);
              }}
              className="hover:bg-red-500/80 p-0.5 px-1 rounded transition cursor-pointer text-white text-[16px] font-bold leading-none flex items-center justify-center"
              title="Close"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* C-Zentrix CZ-Bar Floating Draggable Widget (matching media_1791448189089.png) */}
      {czBarOpen && !czBarMinimized && (
        <div
          id="czbar-floating-widget"
          style={{
            display: "flex",
            left: `${czBarPosition.x}px`,
            top: `${czBarPosition.y}px`,
          }}
        >
          <div
            id="czbar-widget-header"
            style={{ cursor: czBarDragging ? "grabbing" : "grab" }}
            onMouseDown={handleCzBarHeaderMouseDown}
            onTouchStart={handleCzBarHeaderTouchStart}
          >
            <h5>CZ-Bar</h5>
            <div id="czbar-widget-controls">
              <button
                id="czbar-minimize-button"
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setCzBarMinimized(true);
                }}
                title="Minimize"
              >
                −
              </button>
              <button
                id="czbar-close-button"
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setCzBarOpen(false);
                }}
                title="Close"
              >
                ×
              </button>
            </div>
          </div>
          <div id="czbar-widget-body">
            {/* Header: C-ZENTRIX + [0] + User + Power */}
            <div className="flex items-center justify-between pb-1">
              <div className="flex items-center gap-1.5 font-bold text-[15px] text-[#1e293b] tracking-wider select-none">
                <span>C-ZENTRIX</span>
                <div className="grid grid-cols-3 gap-[2px] ml-0.5">
                  <span className="w-[3px] h-[3px] bg-[#2563eb] rounded-full"></span>
                  <span className="w-[3px] h-[3px] bg-[#2563eb] rounded-full"></span>
                  <span className="w-[3px] h-[3px] bg-[#2563eb] rounded-full"></span>
                  <span className="w-[3px] h-[3px] bg-[#2563eb] rounded-full"></span>
                  <span className="w-[3px] h-[3px] bg-[#2563eb] rounded-full"></span>
                  <span className="w-[3px] h-[3px] bg-[#2563eb] rounded-full"></span>
                  <span className="w-[3px] h-[3px] bg-[#2563eb] rounded-full"></span>
                  <span className="w-[3px] h-[3px] bg-[#2563eb] rounded-full"></span>
                  <span className="w-[3px] h-[3px] bg-[#2563eb] rounded-full"></span>
                </div>
              </div>

              <div className="flex items-center gap-2.5 text-[#2563eb]">
                <div className="border border-[#2563eb] rounded px-1.5 py-0.5 text-[11px] font-bold text-[#2563eb] leading-none">
                  0
                </div>
                <button
                  type="button"
                  className="hover:opacity-80 transition cursor-pointer text-[#2563eb]"
                  title="Agent Profile"
                >
                  <User className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="hover:opacity-80 transition cursor-pointer text-[#2563eb]"
                  title="Logout (Click to log out and switch Agent account)"
                >
                  <Power className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Horizontal divider line */}
            <div className="border-b border-[#e2e8f0] my-2 w-full" />

            {/* Agent ID with currently logged-in account (Read-only: agent cannot change ID here, must log out) */}
            <div className="flex items-center justify-end text-[12px] text-[#475569] font-medium pr-1 gap-1.5">
              <span>Agent :</span>
              <span
                className="bg-[#f1f5f9] border border-[#cbd5e1] text-[#0f172a] font-bold text-[12px] px-2 py-0.5 rounded shadow-2xs tracking-tight select-none"
                title={`Currently logged in as ${activeAgentId}. To switch account, click the Power icon above to log out and log in again.`}
              >
                {activeAgentId}
              </span>
            </div>

            {/* Status Time */}
            <div className="text-center text-[13px] font-normal text-[#334155] my-auto py-1">
              {incomingCall ? (
                <span className="text-emerald-600 font-bold animate-pulse">Incoming Triage Call...</span>
              ) : czCallActive ? (
                <div className="flex flex-col items-center justify-center">
                  <div className="text-[13px] text-[#334155]">Call Time {formatCzTime(czCallDuration)}</div>
                  <div className="text-[12px] font-semibold text-[#1e293b] mt-0.5 tracking-wider uppercase">
                    {czCallMode === "outbound" ? "OUTBOUND" : "INBOUND"}
                  </div>
                </div>
              ) : czBreakActive ? (
                <span className="text-amber-600 font-semibold">On Break (00:00:15)</span>
              ) : czDndActive ? (
                <span className="text-rose-600 font-semibold">DND Active</span>
              ) : (
                <span>Free Time {formatCzTime(czFreeSeconds)}</span>
              )}
            </div>

            {/* Middle Section: Incoming Call vs Active Call vs Outbound vs Inbound */}
            {incomingCall ? (
              /* INCOMING CALL IN CZ-BAR */
              <div className="flex flex-col items-center justify-center my-auto w-full text-center">
                {/* Phone number place */}
                <div className="flex justify-center px-2 mb-3 mt-auto w-full">
                  <div className="w-full max-w-[240px] h-[36px] px-3 border-2 border-emerald-500 rounded flex items-center justify-center gap-2 bg-emerald-50 text-[13.5px] font-bold text-emerald-900 shadow-2xs">
                    <PhoneIncoming className="h-4 w-4 text-emerald-600 animate-bounce" />
                    <span>{czPhoneNumber || "+91 6002283107"}</span>
                  </div>
                </div>

                {/* Decline & Accept actions */}
                <div className="flex items-center justify-center gap-3 w-full max-w-[240px] mx-auto mb-6">
                  <button
                    type="button"
                    onClick={handleRejectIncomingCall}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-red-300 bg-red-50 hover:bg-red-100 text-xs font-bold text-red-700 transition cursor-pointer"
                  >
                    <PhoneOff className="h-3.5 w-3.5" /> Decline
                  </button>
                  <button
                    type="button"
                    onClick={handleAcceptIncomingCall}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:brightness-110 text-xs font-bold text-white shadow-md transition active:scale-95 cursor-pointer"
                  >
                    <Phone className="h-3.5 w-3.5 fill-current animate-bounce" /> Accept Call
                  </button>
                </div>
              </div>
            ) : czCallActive ? (
              /* ACTIVE CONNECTED CALL MATCHING media_1791475156011.png */
              <div className="flex flex-col items-center justify-center my-auto w-full text-center">
                {/* Phone number */}
                <div className="text-[16px] font-bold text-[#1e293b] tracking-wider mb-6">
                  {czPhoneNumber ? (czPhoneNumber.startsWith("+") ? czPhoneNumber : `+91${czPhoneNumber}`) : "+916002283107"}
                </div>

                {/* 4 Circular Action Buttons: Hold, Mute, Transfer, Hangup */}
                <div className="flex items-center justify-center gap-3.5 w-full mb-6">
                  {/* 1. Hold Button */}
                  <button
                    type="button"
                    onClick={handleToggleHold}
                    className={`w-10 h-10 rounded-full border-2 flex items-center justify-center transition cursor-pointer active:scale-95 ${
                      isOnHold
                        ? "border-amber-500 bg-amber-500 text-white shadow-sm"
                        : "border-[#2563eb] bg-white text-[#2563eb] hover:bg-blue-50"
                    }`}
                    title={isOnHold ? "Resume Call" : "Hold Call"}
                  >
                    {isOnHold ? <Play className="h-4 w-4 fill-current" /> : <Pause className="h-4 w-4 stroke-[2.5]" />}
                  </button>

                  {/* 2. Mute Button */}
                  <button
                    type="button"
                    onClick={handleToggleMute}
                    className={`w-10 h-10 rounded-full border-2 flex items-center justify-center transition cursor-pointer active:scale-95 ${
                      isMuted
                        ? "border-amber-500 bg-amber-500 text-white shadow-sm"
                        : "border-[#2563eb] bg-white text-[#2563eb] hover:bg-blue-50"
                    }`}
                    title={isMuted ? "Unmute Mic" : "Mute Mic"}
                  >
                    {isMuted ? <MicOff className="h-4 w-4 stroke-[2.5]" /> : <Mic className="h-4 w-4 stroke-[2.5]" />}
                  </button>

                  {/* 3. Transfer Button */}
                  <button
                    type="button"
                    onClick={() => toast.info("Call Transfer Initiated")}
                    className="w-10 h-10 rounded-full border-2 border-[#2563eb] bg-white text-[#2563eb] hover:bg-blue-50 flex items-center justify-center transition cursor-pointer active:scale-95"
                    title="Transfer Call"
                  >
                    <PhoneForwarded className="h-4 w-4 stroke-[2.5]" />
                  </button>

                  {/* 4. Cut / Hangup Button (RED with phone hangup icon) */}
                  <button
                    type="button"
                    onClick={handleEndActiveCall}
                    className="w-10 h-10 rounded-full border-2 border-red-500 bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-md transition cursor-pointer active:scale-95"
                    title="Hangup Call"
                  >
                    <PhoneOff className="h-4 w-4 stroke-[2.5]" />
                  </button>
                </div>
              </div>
            ) : czCallMode === "outbound" ? (
              <>
                {/* Outbound: Phone number input */}
                <div className="flex justify-center px-2 mb-4 mt-auto">
                  <input
                    type="text"
                    value={czPhoneNumber}
                    onChange={(e) => setCzPhoneNumber(e.target.value)}
                    placeholder="Phone number"
                    className="w-full max-w-[240px] h-[36px] px-3 border border-[#cbd5e1] rounded text-center text-[13px] text-[#1e293b] placeholder-[#94a3b8] outline-none focus:border-[#2563eb] transition bg-white"
                  />
                </div>

                {/* Outbound: Green Call Button */}
                <div className="flex justify-center mb-6">
                  <button
                    type="button"
                    onClick={handleCzDial}
                    className="w-11 h-11 rounded-full border-2 border-[#16a34a] bg-white hover:bg-[#16a34a] text-[#16a34a] hover:text-white flex items-center justify-center transition shadow-2xs cursor-pointer active:scale-95 group"
                    title="Call"
                  >
                    <Phone className="h-5 w-5 fill-current stroke-[2.2]" />
                  </button>
                </div>
              </>
            ) : (
              /* Inbound: Waiting for Call (matching media_1791448528378.png) */
              <div className="flex flex-col items-center justify-center my-auto pb-14 w-full">
                <div className="flex items-center justify-between border-b border-[#cbd5e1] pb-1.5 w-full max-w-[240px] px-1 text-[#64748b]">
                  <span className="text-[14px] font-normal text-[#64748b]">Waiting for Call</span>
                  <Phone className="h-4 w-4 text-[#2563eb] fill-[#2563eb]" />
                </div>
              </div>
            )}

            {/* Bottom action toolbar matching media_1791475156011.png */}
            <div className="mt-auto border border-[#2563eb] rounded-full px-2.5 py-1.5 flex items-center justify-between bg-white shadow-2xs">
              {/* 1. Mode toggle */}
              <button
                type="button"
                onClick={toggleCallMode}
                className="w-7 h-7 rounded-full border border-[#2563eb] text-[#2563eb] flex items-center justify-center hover:bg-[#2563eb] hover:text-white transition cursor-pointer"
                title={
                  czCallMode === "outbound"
                    ? "Outbound Mode (Click to switch to Inbound)"
                    : "Inbound Mode (Click to switch to Outbound)"
                }
              >
                {czCallMode === "outbound" ? (
                  <Ban className="h-3.5 w-3.5" />
                ) : (
                  <PhoneCall className="h-3.5 w-3.5" />
                )}
              </button>
              {/* 2. Conference */}
              <button
                type="button"
                className="w-7 h-7 rounded-full border border-[#2563eb] text-[#2563eb] flex items-center justify-center hover:bg-[#2563eb] hover:text-white transition cursor-pointer"
                title="Conference"
              >
                <Users className="h-3.5 w-3.5" />
              </button>
              {/* 3. Audio / Volume */}
              <button
                type="button"
                className="w-7 h-7 rounded-full border border-[#2563eb] text-[#2563eb] flex items-center justify-center hover:bg-[#2563eb] hover:text-white transition cursor-pointer"
                title="Audio"
              >
                <Volume2 className="h-3.5 w-3.5" />
              </button>
              {/* 4. Wrapup / CRM Sync */}
              <button
                type="button"
                onClick={handleRefresh}
                className="w-7 h-7 rounded-full border border-[#2563eb] text-[#2563eb] flex items-center justify-center hover:bg-[#2563eb] hover:text-white transition cursor-pointer"
                title="Refresh / Sync"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
              {/* 5. Notes / Script */}
              <button
                type="button"
                onClick={() => setActiveNav("Beneficiary")}
                className="w-7 h-7 rounded-full border border-[#2563eb] text-[#2563eb] flex items-center justify-center hover:bg-[#2563eb] hover:text-white transition cursor-pointer"
                title="Beneficiary Form"
              >
                <ClipboardCheck className="h-3.5 w-3.5" />
              </button>
              {/* 6. Settings */}
              <button
                type="button"
                onClick={() => setCzDndActive(!czDndActive)}
                className={`w-7 h-7 rounded-full border flex items-center justify-center transition cursor-pointer ${
                  czDndActive
                    ? "bg-[#2563eb] text-white border-[#2563eb]"
                    : "border-[#2563eb] text-[#2563eb] hover:bg-[#2563eb] hover:text-white"
                }`}
                title="DND Mode"
              >
                <Sliders className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Survey Answers Modal */}
      {surveyModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-white shrink-0">
              <h4 className="font-bold text-slate-800 text-[17px]">Survey Answers</h4>
              <button
                type="button"
                onClick={() => setSurveyModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 transition cursor-pointer p-1 rounded hover:bg-slate-100"
                title="Close"
              >
                <X className="h-4 w-4 stroke-[2.5]" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 text-[13px] text-[#1f272e] flex-1">
              {/* Additional Information */}
              <div>
                <h6 className="text-[14px] font-semibold text-[#1a385c] mb-2.5">Additional Information</h6>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 text-[13px] text-slate-800">
                  <div>
                    <strong>Campaign:</strong> {selectedSurvey?.campaign || ""}
                  </div>
                  <div>
                    <strong>Call Type:</strong>{" "}
                    {String(selectedSurvey?.campaign || "").toLowerCase().includes("triage") ||
                    String(selectedSurvey?.form || "").toLowerCase().includes("triage")
                      ? ""
                      : (selectedSurvey?.callType || "")}
                  </div>
                  <div>
                    <strong>Category:</strong>{" "}
                    {String(selectedSurvey?.campaign || "").toLowerCase().includes("triage") ||
                    String(selectedSurvey?.form || "").toLowerCase().includes("triage")
                      ? ""
                      : (selectedSurvey?.category || "")}
                  </div>
                  <div>
                    <strong>Sub Category:</strong>{" "}
                    {String(selectedSurvey?.campaign || "").toLowerCase().includes("triage") ||
                    String(selectedSurvey?.form || "").toLowerCase().includes("triage")
                      ? ""
                      : (selectedSurvey?.subCategory || "")}
                  </div>
                </div>
              </div>

              {/* Survey Questions */}
              <div>
                <h6 className="text-[14px] font-semibold text-[#1a385c] mb-2.5">Survey Questions</h6>
                <div className="border border-slate-200 rounded overflow-hidden">
                  <table className="w-full text-left border-collapse text-[12.5px]">
                    <thead className="bg-[#f8f9fa] border-b border-slate-200 text-[#556370]">
                      <tr>
                        <th className="py-2.5 px-3.5 w-1/2 font-semibold border-r border-slate-200">Question</th>
                        <th className="py-2.5 px-3.5 w-1/2 font-semibold">Answer</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-slate-800">
                      {(() => {
                        const raw = selectedSurvey?.responses || [
                          { q: "Case ID", a: "CA0177AB01" },
                          { q: "Triage Urgency Level", a: "Moderate" },
                          { q: "Urgency Category", a: "Moderate" },
                          { q: "Summary", a: "Fever and body pain" },
                        ];
                        // 1. Rename "Complaint" to "Summary"
                        let normalized = raw.map((r) => {
                          if (r.q?.toLowerCase() === "complaint") return { ...r, q: "Summary" };
                          return r;
                        });

                        // 2. Position "Primary Referral by AI" just above "Recommended Facility by Agent"
                        const referralItem = normalized.find((r) => r.q === "Primary Referral by AI");
                        const recIdx = normalized.findIndex((r) => r.q === "Recommended Facility by Agent" || r.q === "Recommended Facility");
                        if (referralItem && recIdx !== -1) {
                          const withoutReferral = normalized.filter((r) => r.q !== "Primary Referral by AI");
                          const newRecIdx = withoutReferral.findIndex((r) => r.q === "Recommended Facility by Agent" || r.q === "Recommended Facility");
                          normalized = [
                            ...withoutReferral.slice(0, newRecIdx),
                            referralItem,
                            ...withoutReferral.slice(newRecIdx),
                          ];
                        }

                        // 3. Clean Recommended Facility by Agent: if not changed by agent from AI, keep blank
                        const aiReferralText = (normalized.find((r) => r.q === "Primary Referral by AI")?.a || "").toLowerCase().trim();
                        normalized = normalized.map((r) => {
                          if (r.q === "Recommended Facility by Agent" || r.q === "Recommended Facility") {
                            const val = (r.a || "").trim();
                            const valLower = val.toLowerCase();
                            if (
                              val.toUpperCase().includes("REFER TO DISTRICT HOSPITAL / PUBLIC HEALTHCARE") ||
                              (aiReferralText && (valLower === aiReferralText || (aiReferralText.includes("104") && valLower.includes("104"))))
                            ) {
                              return { ...r, a: "" };
                            }
                          }
                          return r;
                        });

                        return normalized.map((resp, rIdx) => (
                          <tr key={rIdx} className="hover:bg-slate-50/70 transition">
                            <td className="py-2 px-3.5 border-r border-slate-200 font-medium">{resp.q}</td>
                            <td className="py-2 px-3.5 text-slate-700">{resp.a || "—"}</td>
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 border-t border-slate-200 bg-white flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setSurveyModalOpen(false)}
                className="px-5 py-2 bg-[#1a385c] hover:bg-[#132c49] text-white font-semibold rounded text-[13px] transition cursor-pointer shadow-xs active:scale-95"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Triage Report Delete / Bulk Delete */}
      {deleteTriageModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                  <Trash2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-[16px] font-bold text-slate-900">
                    {deleteTriageModal.type === "bulk" ? "Delete Triage Reports?" : "Delete Triage Report?"}
                  </h3>
                  <p className="text-[13px] text-slate-600 mt-1.5 leading-relaxed">
                    {deleteTriageModal.type === "bulk" ? (
                      <>
                        Are you sure you want to delete <span className="font-semibold text-slate-900">{deleteTriageModal.count}</span> selected triage reports? This action cannot be undone.
                      </>
                    ) : (
                      <>
                        Are you sure you want to delete the triage report for Case <span className="font-semibold text-slate-900">{deleteTriageModal.caseId || deleteTriageModal.id}</span>? This action cannot be undone.
                      </>
                    )}
                  </p>
                </div>
              </div>
            </div>
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeleteTriageModal({ isOpen: false, type: "single", id: null, caseId: "", beneficiaryId: null, count: 0 })}
                className="px-4 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded text-[13px] font-medium transition cursor-pointer shadow-2xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (deleteTriageModal.type === "bulk") {
                    handleBulkDeleteTriageReports();
                  } else {
                    handleDeleteSingleTriageReport(deleteTriageModal.id, deleteTriageModal.beneficiaryId, deleteTriageModal.caseId);
                  }
                }}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-[13px] font-medium transition cursor-pointer shadow-sm active:scale-95"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Delete Call Log */}
      {deleteCallLogModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                  <Trash2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-[16px] font-bold text-slate-900">
                    {deleteCallLogModal.type === "bulk" ? "Delete Call Logs?" : "Delete Call Log?"}
                  </h3>
                  <p className="text-[13px] text-slate-600 mt-1.5 leading-relaxed">
                    {deleteCallLogModal.type === "bulk" ? (
                      <>
                        Are you sure you want to delete <span className="font-semibold text-slate-900">{deleteCallLogModal.count}</span> selected call logs? This action will permanently remove them from reports and beneficiary history.
                      </>
                    ) : (
                      <>
                        Are you sure you want to delete the call log for <span className="font-semibold text-slate-900">{deleteCallLogModal.name || "this beneficiary"}</span>? This record will be permanently deleted.
                      </>
                    )}
                  </p>
                </div>
              </div>
            </div>
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeleteCallLogModal({ isOpen: false, type: "single", id: null, name: "", count: 0 })}
                className="px-4 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded text-[13px] font-medium transition cursor-pointer shadow-2xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (deleteCallLogModal.type === "bulk") {
                    handleBulkDeleteCallLogs();
                  } else {
                    handleDeleteSingleCallLog(deleteCallLogModal.id);
                  }
                }}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-[13px] font-medium transition cursor-pointer shadow-sm active:scale-95"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Delete / Bulk Delete */}
      {confirmDeleteModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                  <Trash2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-[16px] font-bold text-slate-900">
                    {confirmDeleteModal.type === "bulk" ? "Delete Beneficiaries?" : "Delete Beneficiary?"}
                  </h3>
                  <p className="text-[13px] text-slate-600 mt-1.5 leading-relaxed">
                    {confirmDeleteModal.type === "bulk" ? (
                      <>
                        Are you sure you want to delete <span className="font-semibold text-slate-900">{confirmDeleteModal.count}</span> selected beneficiaries? This action cannot be undone.
                      </>
                    ) : (
                      <>
                        Are you sure you want to delete beneficiary <span className="font-semibold text-slate-900">{confirmDeleteModal.name}</span> ({confirmDeleteModal.id})? This action cannot be undone.
                      </>
                    )}
                  </p>
                </div>
              </div>
            </div>
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmDeleteModal({ isOpen: false, type: "single", id: null, name: "", count: 0 })}
                className="px-4 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded text-[13px] font-medium transition cursor-pointer shadow-2xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirmDeleteModal.type === "bulk") {
                    handleBulkDeleteBeneficiaries();
                  } else {
                    handleDeleteBeneficiary(confirmDeleteModal.id);
                  }
                }}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-[13px] font-medium transition cursor-pointer shadow-sm active:scale-95"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  </div>
  );
}

export default CrmIntegratedView;
