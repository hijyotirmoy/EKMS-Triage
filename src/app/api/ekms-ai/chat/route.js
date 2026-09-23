import { NextResponse } from "next/server";

function detectSeverityAndDuration(allText) {
  const lower = (allText || "").toLowerCase();

  // 1. Duration Detection
  let detectedDuration = "Today";
  if (
    lower.includes("less than 2 hours") ||
    lower.includes("< 30") ||
    lower.includes("<30") ||
    lower.includes("30 min") ||
    lower.includes("minutes") ||
    lower.includes("just started") ||
    lower.includes("1 to 2 hour") ||
    lower.includes("1-2 hour") ||
    lower.includes("achanak") ||
    lower.includes("sudden")
  ) {
    detectedDuration = "Less than 2 hours";
  } else if (
    lower.includes("4 day") ||
    lower.includes("4-7 day") ||
    lower.includes("char din") ||
    lower.includes("4 din") ||
    lower.includes("5 day") ||
    lower.includes("6 day") ||
    lower.includes("7 day")
  ) {
    detectedDuration = "4-7 days";
  } else if (
    lower.includes("2 day") ||
    lower.includes("3 day") ||
    lower.includes("2-3 day") ||
    lower.includes("do din") ||
    lower.includes("teen din") ||
    lower.includes("do teen din")
  ) {
    detectedDuration = "2-3 days";
  } else if (
    lower.includes("1 day") ||
    lower.includes("ek din") ||
    lower.includes("kal se") ||
    lower.includes("yesterday") ||
    lower.includes("24 hours")
  ) {
    detectedDuration = "1 day";
  } else if (
    lower.includes("more than a week") ||
    lower.includes("hafta") ||
    lower.includes("10 days") ||
    lower.includes("two weeks") ||
    lower.includes("2 weeks")
  ) {
    detectedDuration = "More than a week";
  } else if (
    lower.includes("month") ||
    lower.includes("mahina") ||
    lower.includes("months") ||
    lower.includes("chronic")
  ) {
    detectedDuration = "More than a month";
  } else if (
    lower.includes("today") ||
    lower.includes("aaj") ||
    lower.includes("subah se")
  ) {
    detectedDuration = "Today";
  }

  // 2. Severity Detection (1-10)
  let detectedSeverity = 5;
  if (
    lower.includes("crushing") ||
    lower.includes("squeezing") ||
    lower.includes("heart") ||
    lower.includes("chhati") ||
    lower.includes("chest") ||
    lower.includes("radiating") ||
    lower.includes("baayein haath") ||
    lower.includes("thanda pasina") ||
    lower.includes("sweating") ||
    lower.includes("unbearable") ||
    lower.includes("distressing") ||
    lower.includes("extremely severe") ||
    lower.includes("unable to function") ||
    lower.includes("high grade") ||
    lower.includes("pesticide") ||
    lower.includes("bleeding") ||
    lower.includes("khoon") ||
    lower.includes("saans lene me bohot dikkat") ||
    lower.includes("breathlessness")
  ) {
    detectedSeverity = 8;
    if (
      lower.includes("crushing") ||
      lower.includes("baayein haath") ||
      lower.includes("unbearable") ||
      lower.includes("pesticide")
    ) {
      detectedSeverity = 9;
    }
  } else if (
    lower.includes("moderate") ||
    lower.includes("uncomfortable") ||
    lower.includes("100.5") ||
    lower.includes("102") ||
    lower.includes("badha hua") ||
    lower.includes("chakkar") ||
    lower.includes("fever") ||
    lower.includes("bukhar") ||
    lower.includes("pet me dard") ||
    lower.includes("vomiting") ||
    lower.includes("ulti")
  ) {
    detectedSeverity = 6;
  } else if (
    lower.includes("mild") ||
    lower.includes("manageable") ||
    lower.includes("halka") ||
    lower.includes("minor cut") ||
    lower.includes("sardi") ||
    lower.includes("kharash")
  ) {
    detectedSeverity = 3;
  }

  return { detectedSeverity, detectedDuration };
}

// Generates dynamic, clinically adaptive probing questions for the agent to ask next
function getDynamicProbingQuestions({ prompt = "", history = [], currentTriage = {}, stage = "symptom" }) {
  const fullText = [
    ...history.map((h) => h.content || ""),
    prompt,
    currentTriage.symptom || "",
    currentTriage.condition || "",
  ]
    .join(" ")
    .toLowerCase();

  // 1. Cardiac / Chest Pain / High BP
  if (
    fullText.includes("chest") ||
    fullText.includes("chhati") ||
    fullText.includes("heart") ||
    fullText.includes("crushing") ||
    fullText.includes("pressure") ||
    fullText.includes("angina") ||
    fullText.includes("bp")
  ) {
    if (history.length > 4 || stage === "duration") {
      return [
        "Kya dard achanak shuru hua tha ya chalne se badhta hai? (Did it start suddenly, and does walking/exertion worsen it?)",
        "Kya letne par saans zyada phool rahi hai? (Does lying flat worsen breathing difficulty?)",
        "Pehle kabhi heart attack ya stent laga tha? (Any prior history of heart attack or cardiac stent?)",
      ];
    }
    if (history.length >= 2 || stage === "associated") {
      return [
        "Kya dard baayein haath, peeth ya jabde tak phail raha hai? (Is pain radiating to left arm, back, or jaw?)",
        "Kya thanda pasina (diaphoresis) ya ghabrahat aa rahi hai? (Is there cold clammy sweating or fainting?)",
        "Kya Sorbitrate ya koi BP ki emergency dawai li hai? (Has any nitrate/BP medication been taken?)",
      ];
    }
    return [
      "Kya unhe saans lene mein takleef ho rahi hai? (Is there breathing difficulty?)",
      "Kya wo hosh mein hain aur baat kar pa rahe hain? (Is caller fully conscious?)",
      "Kya unhe koi pehle se dil ki bimari ya high BP hai? (History of cardiac disease or hypertension?)",
    ];
  }

  // 2. Respiratory / Breathlessness / Asthma
  if (
    fullText.includes("saans") ||
    fullText.includes("breath") ||
    fullText.includes("asthma") ||
    fullText.includes("wheezing")
  ) {
    if (stage === "severity" || fullText.includes("severe") || fullText.includes("seeti")) {
      return [
        "Kya wo poore sentence bol pa rahe hain bina saans toote? (Can caller speak full sentences without gasping?)",
        "Kya honth ya nakhun neele (cyanosis) pad rahe hain? (Are lips or fingertips turning bluish?)",
        "Kya unke paas Asthalin/Inhaler hai aur kya unhone puffs liye? (Do they have an emergency inhaler and taken puffs?)",
      ];
    }
    return [
      "Kya achanak saans phoolna shuru hua ya pehle se tha? (Did breathlessness start suddenly or gradual?)",
      "Kya chhati mein seeti jaisi aawaz (wheezing) aa rahi hai? (Is there audible wheezing sound from chest?)",
      "Pehle kabhi asthma ke liye ICU ya oxygen support laga tha? (Any past history of ICU/oxygen for asthma?)",
    ];
  }

  // 3. Fever / Chills / Infections
  if (
    fullText.includes("bukhar") ||
    fullText.includes("fever") ||
    fullText.includes("temp") ||
    fullText.includes("shivering")
  ) {
    if (stage === "severity" || fullText.includes("high grade") || fullText.includes("shivering")) {
      return [
        "Kya gardan mein akadpan ya tez sar dard hai? (Is there neck stiffness, severe headache, or confusion?)",
        "Kya sharir par koi lal daane ya rash dikh rahe hain? (Are there any skin rashes or red spots?)",
        "Kya patient paani aur khana andar rakh pa rahe hain? (Can caller retain fluids or continuous vomiting?)",
      ];
    }
    return [
      "Kya bukhar ke saath tez kapkapi ya thand lag rahi hai? (Is there severe shivering or rigors?)",
      "Kitne din se bukhar hai aur kya dawai lene par utar raha hai? (How many days and does medicine lower temperature?)",
      "Kya pishab mein jalan ya pishab kam aa raha hai? (Is there burning micturition or reduced urine output?)",
    ];
  }

  // 4. Occupational Injury / Trauma / Bleeding
  if (
    fullText.includes("cut") ||
    fullText.includes("chot") ||
    fullText.includes("injury") ||
    fullText.includes("bleed") ||
    fullText.includes("khoon")
  ) {
    return [
      "Kya khoon lagatar beh raha hai ya patti lagane se ruk raha hai? (Is there active uncontrolled bleeding?)",
      "Kya chot wali ungli ya ang sunn pad gaya hai? (Is there numbness or inability to move the limb?)",
      "Pichle 6 se 12 mahine mein Tetanus injection lagwaya tha? (When was the last Tetanus vaccination given?)",
    ];
  }

  // 5. Chemical / Pesticide Exposure
  if (
    fullText.includes("pesticide") ||
    fullText.includes("poison") ||
    fullText.includes("chemical") ||
    fullText.includes("spray") ||
    fullText.includes("aankh")
  ) {
    return [
      "Kya aankhon mein teekhi jalan, ulti ya laar zyada aa rahi hai? (Is there excessive salivation, vomiting, or eye burning?)",
      "Kya kapde utaar kar sharir ko saaf paani se dhoya gaya? (Have contaminated clothes been removed and washed?)",
      "Kya behoshi, ajeeb harkat ya chakkar aa raha hai? (Is caller confused, lethargic, or having tremors?)",
    ];
  }

  // 6. Abdominal / Gastric Pain
  if (
    fullText.includes("pet") ||
    fullText.includes("abdominal") ||
    fullText.includes("gastric") ||
    fullText.includes("vomit") ||
    fullText.includes("ulti")
  ) {
    return [
      "Kya ulti mein khoon ya kaala stool (malena) aaya hai? (Is there blood in vomit or dark black stool?)",
      "Kya pet chhoone par pathar jaisa kadhak (rigid) hai? (Is the abdomen board-like rigid or severely tender?)",
      "Kya dard achanak chhuri jaisa teekha shuru hua tha? (Was there sudden severe stabbing onset?)",
    ];
  }

  // Default General Emergency Probing Questions
  return [
    "Kya unhe saans lene mein takleef ho rahi hai? (Is there breathing difficulty?)",
    "Kya wo hosh mein hain aur baat kar pa rahe hain? (Is caller fully conscious?)",
    "Kya unhe koi pehle se purani bimari ya dawai chal rahi hai? (Any significant chronic medical history?)",
  ];
}

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      prompt,
      lastAnswer = "",
      history = [],
      sessionId = "session-" + Date.now(),
      currentTriage = {},
      currentStage = "symptom",
    } = body;

    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    // Combine all conversation text to perform accurate whole-dialogue symptom detection
    const fullConversationText = [
      ...history.map((h) => h.content || ""),
      prompt,
    ].join(" ");

    const { detectedSeverity, detectedDuration } = detectSeverityAndDuration(fullConversationText);

    // Direct Anthropic API call if ANTHROPIC_API_KEY is configured
    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": process.env.ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-3-5-sonnet-20241022",
            max_tokens: 700,
            system: `You are EKMS AI adaptive clinical questioning assistant for ESIC/ESIS Assam call center.
Guide the operator through 4 steps:
Step 1: Symptom
Step 2: Severity
Step 3: Duration
Step 4: Associated (multi-select)
After Step 4 is answered, stage is 'complete'. In 'complete' stage, agentScript MUST be short and what the agent should say to the IP, e.g.: 'Ask the IP: "Please wait for a minute while I check your details and find the nearest facility for you."'

Output strictly valid JSON with keys:
{
  "agentScript": "The script for the agent to speak to the IP",
  "stage": "symptom" | "severity" | "duration" | "associated" | "complete",
  "isMultiSelect": boolean,
  "options": array of strings,
  "probingQuestions": array of 2-3 clinical probing questions in bilingual format 'Hindi (English)',
  "detectedSeverity": integer 1-10,
  "detectedDuration": string matching one of: ["Less than 2 hours", "Today", "1 day", "2-3 days", "4-7 days", "More than a week", "More than a month"],
  "triageSummary": {
    "symptom": string,
    "severity": string,
    "duration": string,
    "associated": array of strings
  }
}`,
            messages: [
              ...history.map((h) => ({
                role: h.role === "bot" || h.role === "assistant" ? "assistant" : "user",
                content: h.content,
              })),
              { role: "user", content: prompt },
            ],
          }),
        });

        if (anthropicRes.ok) {
          const aData = await anthropicRes.json();
          const text = aData.content?.[0]?.text;
          if (text) {
            const parsed = JSON.parse(text.replace(/```json/g, "").replace(/```/g, "").trim());
            const dynamicProbing =
              parsed.probingQuestions && parsed.probingQuestions.length > 0
                ? parsed.probingQuestions
                : getDynamicProbingQuestions({ prompt, history, currentTriage, stage: parsed.stage });

            return NextResponse.json({
              ...parsed,
              probingQuestions: dynamicProbing,
              detectedSeverity: parsed.detectedSeverity || detectedSeverity,
              detectedDuration: parsed.detectedDuration || detectedDuration,
            });
          }
        }
      } catch (aErr) {
        console.warn("Direct Anthropic chat call notice:", aErr.message);
      }
    }

    // Determine the next step in the 4-step clinical flow
    const p = prompt.toLowerCase();
    const prevStage = currentStage || currentTriage?.stage || "symptom";

    let nextStage = "severity";
    let isMultiSelect = false;
    let agentScript = "";
    let options = [];
    let isComplete = false;

    let triageSummary = {
      symptom: currentTriage.symptom || prompt,
      severity: currentTriage.severity || null,
      duration: currentTriage.duration || null,
      associated: Array.isArray(currentTriage.associated) ? [...currentTriage.associated] : [],
      condition: currentTriage.condition || null,
    };

    if (prevStage === "symptom") {
      // Transition to Step 2: Severity
      nextStage = "severity";
      triageSummary.symptom = prompt;

      if (p.includes("chest") || p.includes("chhati") || p.includes("heart")) {
        triageSummary.condition = "Suspected Acute Coronary Syndrome / Angina";
        agentScript = "Ask the IP: 'How would you describe the chest pain sensation and intensity?'";
        options = [
          "Heavy crushing / Squeezing pressure",
          "Sharp stabbing / Worsens with deep breath",
          "Burning / Acidity sensation",
          "Mild ache / Muscular tightness",
        ];
      } else if (p.includes("bukhar") || p.includes("fever") || p.includes("temp")) {
        triageSummary.condition = "Acute Febrile Illness";
        agentScript = "Ask the IP: 'How intense is the fever, and is it accompanied by severe shivering or chills?'";
        options = [
          "High Grade (>102°F) with Shivering & Rigors",
          "Moderate (100.5°F - 102°F)",
          "Mild (99°F - 100°F) manageable",
          "Intermittent fever spikes",
        ];
      } else if (p.includes("saans") || p.includes("breath") || p.includes("asthma")) {
        triageSummary.condition = "Acute Respiratory Distress";
        agentScript = "Ask the IP: 'How difficult is the breathing? Can you speak complete sentences?'";
        options = [
          "Severe distress / Cannot speak full sentence",
          "Moderate shortness of breath with wheezing",
          "Mild breathlessness on walking",
          "Chest tightness with dry cough",
        ];
      } else if (p.includes("cut") || p.includes("injury") || p.includes("chot") || p.includes("wound")) {
        triageSummary.condition = "Occupational Injury / Trauma";
        agentScript = "Ask the IP: 'Is there active continuous bleeding or deep tissue involvement?'";
        options = [
          "Active continuous bleeding / Deep wound",
          "Moderate cut, bleeding stopped with pressure",
          "Minor superficial cut / scrape",
          "Suspected fracture / Severe swelling",
        ];
      } else if (p.includes("pesticide") || p.includes("poison") || p.includes("chemical") || p.includes("spray")) {
        triageSummary.condition = "Toxic Chemical / Pesticide Exposure";
        agentScript = "Ask the IP: 'Are you having eye burning, nausea, dizziness, or blurred vision?'";
        options = [
          "Severe eye irritation & continuous vomiting",
          "Difficulty breathing & chemical smell on clothes",
          "Dizziness, nausea & sweating",
          "Mild skin itching / burning",
        ];
      } else {
        agentScript = "Ask the IP: 'Can you describe how intense this pain or symptom is, and does it prevent normal activity?'";
        options = [
          "Extremely severe — unable to function",
          "Severe — distressing",
          "Moderate — uncomfortable",
          "Mild — manageable",
        ];
      }
    } else if (prevStage === "severity") {
      // Transition to Step 3: Duration
      nextStage = "duration";
      triageSummary.severity = prompt;
      agentScript = "Ask the IP: 'How long have you had this condition? Exactly when did it start?'";
      options = [
        "Less than 2 hours (Sudden / Recent)",
        "Today (A few hours)",
        "1 day (Started yesterday)",
        "2-3 days",
        "4-7 days",
        "More than a week",
      ];
    } else if (prevStage === "duration") {
      // Transition to Step 4: Associated (Multi-select)
      nextStage = "associated";
      triageSummary.duration = prompt;
      isMultiSelect = true;
      agentScript = "Ask the IP: 'Are you experiencing any of these companion symptoms? (Select all that apply)'";
      options = [
        "Cold sweating & clamminess",
        "Pain radiating to left arm / jaw / back",
        "Shortness of breath / Wheezing",
        "Dizziness / Fainting sensation",
        "Nausea or vomiting",
        "High fever with shivering",
        "Bleeding or swelling",
        "None of these",
      ];
    } else if (prevStage === "associated" || prevStage === "complete") {
      // Step 4 is finished! Progression complete!
      nextStage = "complete";
      isComplete = true;
      const associatedItems = prompt
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s && !s.toLowerCase().includes("none"));
      triageSummary.associated = associatedItems;

      agentScript = 'Ask the IP: "Please wait for a minute while I check your details and find the nearest facility for you."';
      options = [];
    }

    // Dynamically generate the 2-3 probing questions tailored to the current stage, symptoms, and previous answer
    const probingQuestions = isComplete
      ? []
      : getDynamicProbingQuestions({
          prompt,
          history,
          currentTriage: triageSummary,
          stage: nextStage,
        });

    return NextResponse.json({
      agentScript,
      answer: agentScript,
      options,
      probingQuestions,
      stage: nextStage,
      isMultiSelect,
      isComplete,
      detectedSeverity,
      detectedDuration,
      triageSummary,
      decision: triageSummary.condition ? { condition: triageSummary.condition } : null,
    });
  } catch (err) {
    console.error("EKMS AI chat error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
