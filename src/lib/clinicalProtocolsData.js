export const clinicalProtocols = [
  {
    "group_id": "CARDIAC_001",
    "group_name": "CARDIAC CONDITIONS",
    "condition_name": "Acute Myocardial Infarction (Heart Attack)",
    "trigger_keywords": ["chest pain", "heart attack", "seene mein dard", "dil ka dora", "left arm pain", "jaw pain", "crushing chest", "heart pain", "baayein haath mein dard"],
    "probing_questions": [
      "Where exactly is the pain — centre or left side of chest?",
      "Is the pain spreading to the left arm, jaw, shoulder or back?",
      "Is the patient sweating or is the skin cold and clammy?",
      "Is there any breathlessness or difficulty breathing?",
      "Has the person fainted or lost consciousness?",
      "How long has the pain been going on — did it start suddenly?",
      "Does anything make it better, like rest or antacids?",
      "Does the person have a history of heart disease or previous heart attack?"
    ],
    "chief_complaint_patterns": [
      "Crushing central chest pain radiating to left arm with profuse sweating",
      "Sudden onset severe chest tightness with breathlessness and nausea",
      "Chest pressure with cold clammy skin and near-syncope",
      "Epigastric pain with vomiting and sweating in elderly diabetic patient"
    ],
    "condition_mapping": [
      {"pattern": "crushing chest pain + radiation to arm/jaw + diaphoresis", "suspected": "Acute ST-Elevation MI (STEMI)"},
      {"pattern": "chest pain + breathlessness + no radiation", "suspected": "Pulmonary Embolism or NSTEMI"},
      {"pattern": "epigastric pain + sweating + vomiting (elderly/diabetic)", "suspected": "Inferior MI / Silent MI"}
    ],
    "red_flags": ["radiation to arm or jaw", "cold sweat", "collapse", "blue lips", "loss of consciousness", "sudden onset severe chest pain"],
    "urgency_level": "Emergency",
    "forward_to": "108 Ambulance / ESIC Hospital Casualty",
    "notes": "Time-critical: Door-to-balloon time target <90 min for STEMI. Call 108 immediately. Do not give food/water. Advise patient to rest. If available and not allergic, 325 mg aspirin can be given while waiting."
  },
  {
    "group_id": "CARDIAC_002",
    "group_name": "CARDIAC CONDITIONS",
    "condition_name": "Unstable Angina",
    "trigger_keywords": ["chest pain at rest", "angina", "seene mein dard aaram se bhi", "heart pain without exertion", "worsening chest pain"],
    "probing_questions": [
      "Is the chest pain happening at rest, or even at night?",
      "Has the pattern of your usual angina changed — is it more frequent or severe?",
      "Does the pain last more than 20 minutes?",
      "Is the pain relieved by nitroglycerin/sorbitrate?",
      "Is there associated sweating or shortness of breath?",
      "Has the patient had a recent angioplasty or bypass surgery?",
      "Any fever or signs of infection?"
    ],
    "chief_complaint_patterns": [
      "Known angina patient with pain now occurring at rest",
      "Chest pain lasting >20 minutes not relieved by sublingual nitrate",
      "Crescendo pattern angina worsening over past 24–48 hours"
    ],
    "condition_mapping": [
      {"pattern": "rest pain + not relieved by nitrate + >20 min", "suspected": "Unstable Angina / NSTEMI"},
      {"pattern": "exertional chest pain relieved by rest", "suspected": "Stable Angina (not emergency)"},
      {"pattern": "chest pain + troponin elevation", "suspected": "NSTEMI"}
    ],
    "red_flags": ["pain at rest", "not relieved by nitrate", "associated breathlessness", "diaphoresis"],
    "urgency_level": "Emergency",
    "forward_to": "108 Ambulance / ESIC Hospital Casualty",
    "notes": "Unstable angina is an ACS (Acute Coronary Syndrome). Requires urgent ECG and troponin. Do not wait."
  },
  {
    "group_id": "CARDIAC_003",
    "group_name": "CARDIAC CONDITIONS",
    "condition_name": "Cardiac Arrhythmia (Dangerous)",
    "trigger_keywords": ["palpitations", "irregular heartbeat", "dil ki dhadkan", "heart racing", "fainting with palpitation", "blackout heart"],
    "probing_questions": [
      "Is the heart beating very fast, very slow, or irregularly?",
      "Is the person conscious and responsive?",
      "Is there associated chest pain or breathlessness?",
      "Did the person faint or feel like fainting?",
      "Any history of previous heart rhythm problems or pacemaker?",
      "Any recent medication changes or drug use?",
      "Is there sweating or cold clammy skin?"
    ],
    "chief_complaint_patterns": [
      "Sudden rapid irregular heartbeat with breathlessness and near-syncope",
      "Slow heart rate with fainting and pallor",
      "Racing heart rate with chest pain and low blood pressure"
    ],
    "condition_mapping": [
      {"pattern": "fast irregular heart + breathlessness + low BP", "suspected": "Ventricular Tachycardia / AF with RVR"},
      {"pattern": "very slow heart + fainting + pallor", "suspected": "Complete Heart Block / Bradyarrhythmia"},
      {"pattern": "palpitations + syncope + family history of sudden death", "suspected": "Ventricular Fibrillation risk / Long QT"}
    ],
    "red_flags": ["syncope", "chest pain with palpitations", "low blood pressure", "cyanosis", "unresponsive"],
    "urgency_level": "Emergency",
    "forward_to": "108 Ambulance / ESIC Hospital Casualty",
    "notes": "If patient is unresponsive and not breathing, initiate CPR and call 108 immediately."
  },
  {
    "group_id": "CARDIAC_004",
    "group_name": "CARDIAC CONDITIONS",
    "condition_name": "Acute Decompensated Heart Failure",
    "trigger_keywords": ["can't breathe lying down", "legs swelling", "paon mein sujan", "breathlessness at night", "orthopnoea", "foamy sputum", "pink frothy sputum"],
    "probing_questions": [
      "Is the patient able to lie flat or do they need to sit up to breathe?",
      "Is there swelling in both legs?",
      "Is the patient coughing up pink or frothy sputum?",
      "How many pillows does the patient need to sleep?",
      "Is there a history of heart failure, weak heart, or previous cardiac event?",
      "Has there been recent weight gain in a few days?",
      "Any recent missed medications (diuretics, heart failure drugs)?",
      "Any fever suggesting infection as a precipitant?"
    ],
    "chief_complaint_patterns": [
      "Severe breathlessness unable to lie flat, with bilateral leg swelling and pink frothy sputum",
      "Acute worsening of known heart failure with weight gain and worsening oedema",
      "Orthopnoea and paroxysmal nocturnal dyspnoea in known heart failure patient"
    ],
    "condition_mapping": [
      {"pattern": "orthopnoea + pink frothy sputum + bilateral leg oedema", "suspected": "Acute Pulmonary Oedema / Decompensated Heart Failure"},
      {"pattern": "breathlessness + leg swelling + JVD", "suspected": "Right Heart Failure / Biventricular Failure"},
      {"pattern": "worsening breathlessness + fever + cough + known HF", "suspected": "Infection-precipitated HF Decompensation"}
    ],
    "red_flags": ["unable to speak full sentences", "pink frothy sputum", "cyanosis", "SpO2 <90%", "cold peripheries"],
    "urgency_level": "Emergency",
    "forward_to": "108 Ambulance / ESIC Hospital Casualty",
    "notes": "Position patient upright. Oxygen if available. Do not give fluids. Call 108."
  },
  {
    "group_id": "CARDIAC_005",
    "group_name": "CARDIAC CONDITIONS",
    "condition_name": "Pericarditis / Myocarditis",
    "trigger_keywords": ["chest pain worse lying down", "chest pain after viral fever", "sharp chest pain", "perikarditis", "heart inflammation"],
    "probing_questions": [
      "Is the chest pain sharp and worse when lying down or breathing deeply?",
      "Does it get better sitting forward or leaning forward?",
      "Was there a recent viral illness, cold, or fever before the chest pain?",
      "Any fever currently?",
      "Any breathlessness or palpitations?",
      "Is the patient a young person (15–40 years)?",
      "Any recent COVID-19 infection or vaccination?"
    ],
    "chief_complaint_patterns": [
      "Sharp pleuritic chest pain, worse lying flat, better sitting forward — 3 days after flu",
      "Young person with chest pain, fever, and palpitations following viral illness",
      "Chest pain with friction rub on examination, post-COVID"
    ],
    "condition_mapping": [
      {"pattern": "sharp positional chest pain + recent viral illness + fever", "suspected": "Acute Pericarditis"},
      {"pattern": "chest pain + palpitations + elevated troponin + young patient", "suspected": "Myocarditis"},
      {"pattern": "pleuritic chest pain + friction rub + fever", "suspected": "Pericarditis"}
    ],
    "red_flags": ["shock", "hypotension", "muffled heart sounds", "raised JVP", "severe breathlessness (cardiac tamponade)"],
    "urgency_level": "Urgent",
    "forward_to": "ESIC Hospital (same day)",
    "notes": "If haemodynamically unstable (cardiac tamponade), call 108. Otherwise urgent same-day hospital review."
  },
  {
    "group_id": "NEURO_001",
    "group_name": "NEUROLOGICAL CONDITIONS",
    "condition_name": "Ischaemic Stroke / Haemorrhagic Stroke",
    "trigger_keywords": ["face drooping", "arm weakness", "speech problem", "paralysis", "looka", "paralysis one side", "face twist", "stroke", "haath kaam nahi kar raha"],
    "probing_questions": [
      "Is one side of the face drooping or uneven when the patient smiles?",
      "Is one arm or leg suddenly weak — can the patient raise both arms equally?",
      "Is speech slurred or is the patient unable to speak or understand?",
      "When did these symptoms start — exactly what time?",
      "Any sudden severe headache 'worst of life' at the start?",
      "Any loss of consciousness or seizures?",
      "Is the patient on blood thinners (warfarin, aspirin)?",
      "Any history of hypertension, atrial fibrillation, or previous stroke?"
    ],
    "chief_complaint_patterns": [
      "Sudden right-sided facial droop + right arm weakness + slurred speech — 45-min onset",
      "Sudden worst-ever headache followed by loss of consciousness",
      "Acute left-sided hemiplegia with aphasia in hypertensive patient"
    ],
    "condition_mapping": [
      {"pattern": "facial droop + unilateral arm weakness + slurred speech + sudden onset", "suspected": "Ischaemic Stroke (FAST positive)"},
      {"pattern": "worst headache of life + neck stiffness + vomiting", "suspected": "Subarachnoid Haemorrhage"},
      {"pattern": "sudden hemiplegia + hypertension + anticoagulant use", "suspected": "Haemorrhagic Stroke"}
    ],
    "red_flags": ["FAST positive (Face-Arm-Speech-Time)", "sudden worst headache", "loss of consciousness", "seizure at onset"],
    "urgency_level": "Emergency",
    "forward_to": "108 Ambulance / ESIC Hospital with CT Scan capability",
    "notes": "Time = Brain. Thrombolysis window is 4.5 hours for ischaemic stroke. Call 108 immediately. Note the exact time of symptom onset."
  },
  {
    "group_id": "NEURO_002",
    "group_name": "NEUROLOGICAL CONDITIONS",
    "condition_name": "Transient Ischaemic Attack (TIA)",
    "trigger_keywords": ["temporary weakness", "vision loss one eye", "speech came back", "mini stroke", "thodi der ke liye haath nahi chala"],
    "probing_questions": [
      "Did the symptoms completely resolve? How long did they last?",
      "Was there facial droop, arm weakness, or speech difficulty that came and went?",
      "Was there sudden vision loss in one eye like a curtain coming down?",
      "Any history of high blood pressure, diabetes, or smoking?",
      "Has this happened before?",
      "Any history of atrial fibrillation or irregular heartbeat?",
      "Is the patient on any blood thinners?"
    ],
    "chief_complaint_patterns": [
      "Transient 15-minute episode of right arm weakness and slurred speech — now fully resolved",
      "Sudden monocular vision loss lasting 2 minutes — amaurosis fugax",
      "Brief episode of confusion and speech difficulty, resolved within an hour"
    ],
    "condition_mapping": [
      {"pattern": "brief resolved neurological deficit + ABCD2 score ≥4", "suspected": "High-Risk TIA — Stroke imminent"},
      {"pattern": "transient monocular blindness + carotid bruit", "suspected": "TIA / Retinal Artery Occlusion"},
      {"pattern": "resolved hemiparesis + AF history", "suspected": "Cardioembolic TIA"}
    ],
    "red_flags": ["symptoms within last 24 hours", "ABCD2 score ≥4", "crescendo TIAs", "atrial fibrillation"],
    "urgency_level": "Urgent",
    "forward_to": "ESIC Hospital (same day, within 24 hours) / 108 if symptoms ongoing",
    "notes": "Risk of full stroke is highest in first 48–72 hours. Do NOT dismiss TIA. Urgent neurology review required."
  },
  {
    "group_id": "NEURO_003",
    "group_name": "NEUROLOGICAL CONDITIONS",
    "condition_name": "Generalised Tonic-Clonic Seizure",
    "trigger_keywords": ["fits", "mirgi", "dora", "epilepsy", "convulsions", "body shaking", "muh se jhag", "foam from mouth", "unconscious shaking"],
    "probing_questions": [
      "Is the person still convulsing or have the fits stopped?",
      "How long has the seizure been going on?",
      "Is this the first seizure ever, or is the patient a known epileptic?",
      "Is the patient conscious and responsive now?",
      "Was there any tongue biting, urinary incontinence?",
      "Any fever, headache, or recent illness before the fits?",
      "Any history of head injury recently?",
      "Has the patient missed their antiepileptic medication?"
    ],
    "chief_complaint_patterns": [
      "Active generalised tonic-clonic seizure lasting more than 5 minutes — status epilepticus",
      "First-ever seizure in an adult — post-ictal confusion",
      "Known epileptic patient with breakthrough seizure after missing medication"
    ],
    "condition_mapping": [
      {"pattern": "seizure >5 minutes or multiple seizures without recovery", "suspected": "Status Epilepticus — Emergency"},
      {"pattern": "first seizure + fever + neck stiffness", "suspected": "Meningitis / Encephalitis"},
      {"pattern": "seizure + post-ictal + known epilepsy + missed dose", "suspected": "Breakthrough Seizure"}
    ],
    "red_flags": ["seizure lasting >5 minutes", "no recovery between seizures", "first-ever seizure", "focal onset seizure in adult", "fever with seizure in adult"],
    "urgency_level": "Emergency",
    "forward_to": "108 Ambulance / ESIC Hospital Casualty",
    "notes": "Put patient on side (recovery position). Do not put anything in mouth. Time the seizure. If >5 min, this is status epilepticus — call 108."
  },
  {
    "group_id": "NEURO_004",
    "group_name": "NEUROLOGICAL CONDITIONS",
    "condition_name": "Bacterial Meningitis",
    "trigger_keywords": ["neck stiffness", "light hurts eyes", "severe headache stiff neck", "rash with fever", "meningitis", "photophobia", "thigdi gardan"],
    "probing_questions": [
      "Is there a severe headache — worst in their life?",
      "Is there neck stiffness — is it painful to bend the chin to chest?",
      "Is there sensitivity to light (photophobia)?",
      "Is there a rash — especially non-blanching purple or red spots?",
      "Any fever and vomiting along with headache?",
      "Is the person drowsy or confused?",
      "Any recent ear infection, sinusitis, or dental work?",
      "Has the patient had meningitis before?"
    ],
    "chief_complaint_patterns": [
      "Severe headache + high fever + neck stiffness + photophobia — classic meningism",
      "Non-blanching purpuric rash + fever + confusion — meningococcal septicaemia",
      "Rapid deterioration in consciousness with headache and vomiting"
    ],
    "condition_mapping": [
      {"pattern": "headache + fever + neck stiffness + photophobia", "suspected": "Bacterial Meningitis"},
      {"pattern": "headache + purpuric non-blanching rash + fever + shock", "suspected": "Meningococcal Septicaemia"},
      {"pattern": "subacute headache + fever + confusion + immunosuppressed", "suspected": "Viral / Tuberculous Meningitis"}
    ],
    "red_flags": ["non-blanching rash", "GCS drop", "seizures", "papilloedema", "septic shock signs"],
    "urgency_level": "Emergency",
    "forward_to": "108 Ambulance / ESIC Hospital Casualty",
    "notes": "Mortality is high without immediate antibiotics. Time-critical. Do NOT delay for CT scan if clinical diagnosis is clear. Call 108."
  },
  {
    "group_id": "NEURO_005",
    "group_name": "NEUROLOGICAL CONDITIONS",
    "condition_name": "Guillain-Barré Syndrome (GBS)",
    "trigger_keywords": ["legs going weak", "spreading weakness", "can't walk since yesterday", "weakness after diarrhoea", "tingling in feet spreading up", "paralysis after fever"],
    "probing_questions": [
      "When did the weakness start and how quickly is it spreading upwards?",
      "Is there tingling or numbness in the feet or hands?",
      "Was there a diarrhoeal illness or respiratory infection 2–4 weeks ago?",
      "Can the patient walk, or stand without support?",
      "Is there any difficulty swallowing or breathing?",
      "Is the weakness affecting both sides equally?",
      "Any back pain or bladder/bowel changes?"
    ],
    "chief_complaint_patterns": [
      "Ascending bilateral leg weakness starting in feet, spreading rapidly over 3 days after diarrhoea",
      "Progressive weakness + areflexia + post-Campylobacter infection",
      "Rapidly worsening weakness now affecting breathing and swallowing"
    ],
    "condition_mapping": [
      {"pattern": "ascending bilateral weakness + areflexia + post-infectious", "suspected": "Guillain-Barré Syndrome"},
      {"pattern": "GBS + dysphagia + respiratory compromise", "suspected": "GBS with autonomic/respiratory involvement — ICU urgency"},
      {"pattern": "acute flaccid paralysis + preceding diarrhoea", "suspected": "GBS (also rule out polio in unvaccinated child)"}
    ],
    "red_flags": ["respiratory difficulty", "inability to swallow", "rapid progression over hours", "facial weakness"],
    "urgency_level": "Emergency",
    "forward_to": "108 Ambulance / ESIC Hospital with ICU",
    "notes": "Respiratory failure can develop rapidly. Urgent neurology and ICU involvement required. Do not send home."
  },
  {
    "group_id": "NEURO_006",
    "group_name": "NEUROLOGICAL CONDITIONS",
    "condition_name": "Severe Migraine / Thunderclap Headache",
    "trigger_keywords": ["worst headache", "sudden severe headache", "thunder headache", "headache with vomiting", "migraine attack", "sar mein bahut tej dard", "sudden head pain"],
    "probing_questions": [
      "Did the headache come on suddenly and reach maximum severity within seconds (thunderclap)?",
      "Is this the worst headache of the patient's life?",
      "Is there neck stiffness or sensitivity to light?",
      "Any neurological symptoms — weakness, vision changes, speech problems?",
      "Any history of migraines — does this feel different from usual?",
      "Any nausea, vomiting, or visual aura?",
      "Any recent head injury, even minor?"
    ],
    "chief_complaint_patterns": [
      "Thunderclap headache — worst ever, maximum intensity at onset — must rule out SAH",
      "Severe unilateral throbbing headache with nausea, vomiting, photophobia — migraine",
      "Headache with unilateral weakness and visual aura — hemiplegic migraine"
    ],
    "condition_mapping": [
      {"pattern": "thunderclap worst-ever headache at onset", "suspected": "Subarachnoid Haemorrhage until proven otherwise"},
      {"pattern": "unilateral throbbing headache + photophobia + vomiting + no fever + no neck stiffness", "suspected": "Migraine without Aura"},
      {"pattern": "headache + unilateral neurological deficit + aura", "suspected": "Hemiplegic Migraine / TIA — needs imaging"}
    ],
    "red_flags": ["thunderclap onset", "first severe headache", "neck stiffness", "fever", "neurological deficit", "age >50 new headache"],
    "urgency_level": "Emergency (thunderclap) / Urgent (severe migraine)",
    "forward_to": "108 Ambulance for thunderclap; ESIC Hospital same day for severe migraine",
    "notes": "Thunderclap headache = SAH until CT/LP proves otherwise. Never dismiss as migraine without ruling out SAH."
  },
  {
    "group_id": "NEURO_007",
    "group_name": "NEUROLOGICAL CONDITIONS",
    "condition_name": "Viral Encephalitis",
    "trigger_keywords": ["brain fever", "confusion with fever", "behavioural change with fever", "high fever not responding", "delirious", "Japanese encephalitis", "dimag ki bimaari"],
    "probing_questions": [
      "Is the person confused, disoriented, or behaving strangely along with fever?",
      "Any seizures with the fever?",
      "How high is the fever and how long has it been present?",
      "Any neck stiffness?",
      "Any recent travel to areas with Japanese Encephalitis?",
      "Was the person bitten by a mosquito recently in a rural/agricultural area?",
      "Is the patient progressively becoming less responsive?"
    ],
    "chief_complaint_patterns": [
      "High-grade fever + altered mental status + seizures in a farmer from Assam — JE suspected",
      "Fever + behavioural change + headache + neck stiffness",
      "Progressive drowsiness and confusion after 3 days of fever in unimmunised child"
    ],
    "condition_mapping": [
      {"pattern": "fever + altered consciousness + seizures + rural Assam", "suspected": "Japanese Encephalitis"},
      {"pattern": "fever + headache + confusion + neck stiffness", "suspected": "Bacterial Meningitis / Viral Encephalitis"},
      {"pattern": "fever + personality change + temporal lobe signs + CSF changes", "suspected": "Herpes Simplex Encephalitis"}
    ],
    "red_flags": ["altered consciousness", "seizures", "GCS <12", "inability to recognise family members", "flaccid paralysis"],
    "urgency_level": "Emergency",
    "forward_to": "108 Ambulance / ESIC Hospital with Neurology / Government JE referral centre",
    "notes": "Japanese Encephalitis is endemic in Assam. Acute flaccid paralysis must be reported per government protocol. IV acyclovir empirically for suspected HSV encephalitis."
  },
  {
    "group_id": "RESP_001",
    "group_name": "RESPIRATORY CONDITIONS",
    "condition_name": "Acute Severe Asthma Attack",
    "trigger_keywords": ["can't breathe asthma", "inhaler not working", "asthma attack", "wheezing badly", "dama ka daura", "saans nahi aa rahi", "chest tight can't speak"],
    "probing_questions": [
      "Can the patient speak in full sentences?",
      "Has the inhaler (reliever pump) been used — how many times? Is it helping?",
      "Is there a wheeze — high-pitched whistling sound on breathing out?",
      "Is the patient using neck and chest muscles to breathe (accessory muscles)?",
      "Is there a bluish tinge to the lips or fingertips?",
      "How long has the attack been going on?",
      "Has the patient ever been admitted to ICU or intubated for asthma before?",
      "Any known triggers — dust, smoke, pets, cold air, exercise?"
    ],
    "chief_complaint_patterns": [
      "Severe asthma attack — unable to complete full sentences, inhaler not working, cyanosis",
      "Acute bronchospasm with audible wheeze, tachycardia, and accessory muscle use",
      "Near-fatal asthma — silent chest, agitation, exhaustion"
    ],
    "condition_mapping": [
      {"pattern": "unable to speak + wheeze + inhaler not working + cyanosis", "suspected": "Life-Threatening Asthma"},
      {"pattern": "wheeze + SOB + responds to inhaler", "suspected": "Moderate Acute Asthma"},
      {"pattern": "silent chest + severe distress + exhaustion", "suspected": "Near-Fatal Asthma — Imminent Respiratory Arrest"}
    ],
    "red_flags": ["unable to speak in sentences", "silent chest", "cyanosis", "exhaustion", "altered consciousness", "previous ICU admission for asthma"],
    "urgency_level": "Emergency",
    "forward_to": "108 Ambulance / ESIC Hospital Casualty",
    "notes": "Keep patient upright. Assist with inhaler if available (salbutamol 4–10 puffs via spacer). Call 108 immediately if life-threatening features present."
  },
  {
    "group_id": "RESP_002",
    "group_name": "RESPIRATORY CONDITIONS",
    "condition_name": "COPD Exacerbation",
    "trigger_keywords": ["smoker can't breathe", "COPD attack", "emphysema worse", "purulent sputum more breathless", "chronic bronchitis attack", "saans phool rahi hai"],
    "probing_questions": [
      "Is the breathlessness worse than the patient's usual baseline?",
      "Has there been a change in sputum — more yellow or green than usual?",
      "Is the patient using pursed-lip breathing?",
      "Is there confusion or drowsiness (CO2 retention)?",
      "Does the patient use home oxygen or nebuliser?",
      "Any fever suggesting chest infection?",
      "How many hospital admissions in past year for breathing problems?",
      "Can the patient manage their own activities of daily living?"
    ],
    "chief_complaint_patterns": [
      "Known COPD patient with acute worsening breathlessness and increased purulent sputum",
      "Severe COPD exacerbation with confusion, cyanosis, and use of accessory muscles",
      "COPD patient with fever, increased cough, and inability to walk across room"
    ],
    "condition_mapping": [
      {"pattern": "known COPD + increased breathlessness + purulent sputum + fever", "suspected": "Infective COPD Exacerbation"},
      {"pattern": "COPD + confusion + cyanosis + CO2 narcosis signs", "suspected": "Type 2 Respiratory Failure / Hypercapnic Crisis"},
      {"pattern": "breathlessness + wheeze + COPD history + no infection signs", "suspected": "Non-infective COPD Exacerbation"}
    ],
    "red_flags": ["confusion or drowsiness (CO2 retention)", "cyanosis", "unable to speak", "SpO2 <88%", "paradoxical breathing"],
    "urgency_level": "Emergency (severe) / Urgent (moderate)",
    "forward_to": "108 Ambulance for severe / ESIC Hospital for moderate",
    "notes": "Do NOT give high-flow oxygen blindly — risk of CO2 retention. Target SpO2 88–92% in COPD. Caution with oxygen."
  },
  {
    "group_id": "RESP_003",
    "group_name": "RESPIRATORY CONDITIONS",
    "condition_name": "Pulmonary Embolism",
    "trigger_keywords": ["sudden breathlessness", "blood in cough", "leg swelling then breathlessness", "pleuritic chest pain", "PE", "haemoptysis breathless"],
    "probing_questions": [
      "Did the breathlessness come on suddenly without warning?",
      "Is there any coughing up of blood?",
      "Is there pain on breathing deeply (pleuritic pain)?",
      "Is there swelling, redness or pain in one leg (DVT)?",
      "Has the patient been bedridden, had long travel, recent surgery, or is pregnant?",
      "Any history of blood clots before?",
      "Any cancer history?",
      "Is the patient on oral contraceptive pills?"
    ],
    "chief_complaint_patterns": [
      "Sudden onset breathlessness + pleuritic chest pain + haemoptysis post-long flight",
      "Acute breathlessness + right leg swelling and pain — DVT with PE",
      "Sudden hypotension + breathlessness + tachycardia — massive PE"
    ],
    "condition_mapping": [
      {"pattern": "sudden breathlessness + pleuritic pain + haemoptysis + DVT risk", "suspected": "Pulmonary Embolism"},
      {"pattern": "massive PE: hypotension + tachycardia + acute RV strain", "suspected": "Massive Pulmonary Embolism — haemodynamic collapse"},
      {"pattern": "unilateral leg swelling + redness + breathlessness", "suspected": "DVT with PE"}
    ],
    "red_flags": ["hypotension", "syncope", "cyanosis", "very high heart rate", "haemoptysis"],
    "urgency_level": "Emergency",
    "forward_to": "108 Ambulance / ESIC Hospital Casualty",
    "notes": "Massive PE has very high mortality. Thrombolysis may be life-saving. Call 108."
  },
  {
    "group_id": "RESP_004",
    "group_name": "RESPIRATORY CONDITIONS",
    "condition_name": "Severe Pneumonia / CAP",
    "trigger_keywords": ["high fever cough", "breathing fast with fever", "chest infection bad", "saans mein dard with fever", "nyumonia"],
    "probing_questions": [
      "Is the patient breathing very fast (more than 30 breaths/minute)?",
      "Is there confusion or altered consciousness?",
      "Is the blood pressure low?",
      "Is there cyanosis (blue lips or fingers)?",
      "What is the temperature — how high?",
      "Is the patient able to eat and drink?",
      "Any underlying condition — diabetes, COPD, immunosuppression?",
      "Any blood or rust-coloured sputum?"
    ],
    "chief_complaint_patterns": [
      "High fever + fast breathing + confusion + low BP — CURB-65 score 4 severe pneumonia",
      "Productive cough with rust-coloured sputum + fever + pleuritic pain",
      "Elderly patient with new confusion, fast breathing, and low-grade fever — atypical pneumonia"
    ],
    "condition_mapping": [
      {"pattern": "fever + fast breathing >30/min + confusion + low BP", "suspected": "Severe Community-Acquired Pneumonia (CAP) — CURB-65 ≥3"},
      {"pattern": "fever + cough + rust sputum + pleuritic pain + lobar consolidation", "suspected": "Pneumococcal Pneumonia"},
      {"pattern": "atypical presentation + dry cough + fever + confusion in elderly", "suspected": "Atypical / Aspiration Pneumonia"}
    ],
    "red_flags": ["RR >30/min", "confusion", "systolic BP <90", "cyanosis", "failure to maintain SpO2"],
    "urgency_level": "Emergency (severe) / Urgent (moderate)",
    "forward_to": "108 for severe; ESIC Hospital for moderate CURB-65 2",
    "notes": "CURB-65 scoring (Confusion, Urea, Resp Rate, BP, Age ≥65). Score ≥3 = severe, admit to hospital."
  },
  {
    "group_id": "RESP_005",
    "group_name": "RESPIRATORY CONDITIONS",
    "condition_name": "Tension Pneumothorax",
    "trigger_keywords": ["sudden chest pain breathlessness after injury", "air in chest", "sudden collapse after chest trauma", "breathing one side", "chest injury collapse"],
    "probing_questions": [
      "Was there recent chest trauma, injury, or did the patient have a procedure recently?",
      "Did the breathlessness come on very suddenly?",
      "Is the neck shifting to one side?",
      "Is there absent breath sounds on one side?",
      "Is the patient in shock — low BP, rapid heart rate?",
      "Is the patient a young tall thin male?",
      "Any history of previous pneumothorax or lung disease?"
    ],
    "chief_complaint_patterns": [
      "Post-trauma sudden breathlessness with tracheal deviation and absent breath sounds — tension pneumothorax",
      "Young tall thin male with sudden pleuritic chest pain and breathlessness — spontaneous pneumothorax",
      "Worsening breathlessness after central line placement or mechanical ventilation"
    ],
    "condition_mapping": [
      {"pattern": "chest trauma + hypotension + absent breath sounds + tracheal deviation", "suspected": "Tension Pneumothorax — Life-threatening"},
      {"pattern": "tall thin young male + sudden pleuritic chest pain + dyspnoea", "suspected": "Spontaneous Pneumothorax"},
      {"pattern": "COPD + sudden deterioration + hyperresonant side", "suspected": "Secondary Pneumothorax in COPD"}
    ],
    "red_flags": ["hypotension", "tracheal deviation", "absent breath sounds one side", "rapidly deteriorating"],
    "urgency_level": "Emergency",
    "forward_to": "108 Ambulance / ESIC Hospital Casualty",
    "notes": "Tension pneumothorax is immediately life-threatening. Needle decompression at second intercostal space is life-saving. Call 108."
  },
  {
    "group_id": "RESP_006",
    "group_name": "RESPIRATORY CONDITIONS",
    "condition_name": "Anaphylaxis",
    "trigger_keywords": ["allergy attack", "throat swelling", "rash after injection", "bee sting swelling", "food allergy bad", "injection reaction", "gale mein sujan"],
    "probing_questions": [
      "Is there swelling of the lips, tongue, or throat?",
      "Is there difficulty breathing or a hoarse voice?",
      "Is there a skin rash — hives, urticaria, widespread redness?",
      "Did it happen right after eating something, taking a medicine, or after a bee sting?",
      "Is the patient feeling faint or has lost consciousness?",
      "Is the blood pressure dropping — feeling very weak?",
      "Does the patient carry an EpiPen (adrenaline auto-injector)?",
      "Any previous severe allergic reactions?"
    ],
    "chief_complaint_patterns": [
      "Throat swelling + hives + breathlessness + low BP minutes after penicillin injection",
      "Generalised urticaria + facial swelling + stridor after food ingestion",
      "Collapse with wheeze and urticaria after wasp sting"
    ],
    "condition_mapping": [
      {"pattern": "throat swelling + breathlessness + hypotension + exposure to allergen", "suspected": "Anaphylaxis with Shock"},
      {"pattern": "lip/tongue swelling + hives + exposure + no hypotension", "suspected": "Anaphylaxis without Shock — Angioedema"},
      {"pattern": "wheeze + urticaria + bronchospasm after allergen", "suspected": "Anaphylaxis with Respiratory Compromise"}
    ],
    "red_flags": ["stridor", "throat swelling", "hypotension", "loss of consciousness", "severe bronchospasm"],
    "urgency_level": "Emergency",
    "forward_to": "108 Ambulance / ESIC Hospital Casualty",
    "notes": "Adrenaline (epinephrine) IM 0.5mg is first-line treatment. Call 108. Lay patient flat with legs raised (unless breathing difficulty). If EpiPen available, use it."
  },
  {
    "group_id": "GI_001",
    "group_name": "GASTROINTESTINAL CONDITIONS",
    "condition_name": "Acute Appendicitis",
    "trigger_keywords": ["right side stomach pain", "appendix pain", "appendicitis", "pet ke daahine taraf dard", "belly button pain moved right"],
    "probing_questions": [
      "Where exactly is the pain — has it moved from around the belly button to the lower right side?",
      "Is there fever with the abdominal pain?",
      "Is there nausea or vomiting?",
      "Is the pain constant or coming in waves?",
      "Does the pain get worse with movement or coughing?",
      "Is the person unable to walk upright due to pain?",
      "Any loose stools or constipation?",
      "When did the patient last eat or drink?"
    ],
    "chief_complaint_patterns": [
      "Periumbilical pain migrating to right iliac fossa + fever + vomiting — classical appendicitis",
      "Constant right lower quadrant pain worse with movement + rebound tenderness",
      "Child with central abdominal pain, off food, and low-grade fever — rule out appendicitis"
    ],
    "condition_mapping": [
      {"pattern": "RIF pain + fever + vomiting + rebound tenderness", "suspected": "Acute Appendicitis"},
      {"pattern": "generalised peritonism + rigidity + fever + severe pain", "suspected": "Perforated Appendicitis / Peritonitis"},
      {"pattern": "RIF pain + no fever + young female", "suspected": "Appendicitis vs Ovarian Pathology (ectopic/torsion)"}
    ],
    "red_flags": ["rigid abdomen", "severe generalised pain", "high fever with abdominal pain", "shock signs"],
    "urgency_level": "Emergency",
    "forward_to": "108 Ambulance / ESIC Hospital with Surgery",
    "notes": "Keep NBM (nil by mouth). Surgery is definitive treatment. Do not give analgesics that mask severity without medical review."
  },
  {
    "group_id": "GI_002",
    "group_name": "GASTROINTESTINAL CONDITIONS",
    "condition_name": "Upper GI Haemorrhage",
    "trigger_keywords": ["vomiting blood", "black stool", "bloody vomit", "khoon ki ulti", "kala pakhana", "tarry stool", "haematemesis"],
    "probing_questions": [
      "Is the patient vomiting blood — bright red or coffee-ground coloured?",
      "Is there black, tarry, foul-smelling stool?",
      "How much blood — a teaspoon or more than a cup?",
      "Is the patient feeling faint, dizzy, or has collapsed?",
      "Any history of peptic ulcer, liver disease, or cirrhosis?",
      "Any recent use of NSAIDs, aspirin, or alcohol?",
      "Is the patient on blood thinners?",
      "Any recent retching forcefully before the bleed?"
    ],
    "chief_complaint_patterns": [
      "Profuse haematemesis (vomiting bright red blood) with haemodynamic instability",
      "Melaena (black tarry stool) with dizziness and pallor — upper GI bleed",
      "Coffee-ground vomiting in known cirrhotic — variceal bleed"
    ],
    "condition_mapping": [
      {"pattern": "haematemesis + melaena + haemodynamic instability", "suspected": "Massive Upper GI Haemorrhage — Varices or Peptic Ulcer"},
      {"pattern": "bright red blood vomiting after forceful vomiting", "suspected": "Mallory-Weiss Tear"},
      {"pattern": "melaena + NSAID use + epigastric pain history", "suspected": "Bleeding Peptic Ulcer"}
    ],
    "red_flags": ["haemodynamic shock", "large volume blood", "known cirrhosis (varices)", "syncope with haematemesis"],
    "urgency_level": "Emergency",
    "forward_to": "108 Ambulance / ESIC Hospital with Endoscopy / Surgery",
    "notes": "Keep NBM. IV access needed urgently. Do NOT give anything by mouth. Call 108."
  },
  {
    "group_id": "GI_003",
    "group_name": "GASTROINTESTINAL CONDITIONS",
    "condition_name": "Acute Pancreatitis",
    "trigger_keywords": ["severe upper stomach pain", "pain goes to back", "gallstone pain", "alcohol belly pain", "pancreas pain", "pet mein tej dard peeth mein"],
    "probing_questions": [
      "Is the pain in the upper abdomen going through to the back?",
      "Is the pain constant and very severe?",
      "Any history of gallstones or heavy alcohol intake?",
      "Is there vomiting with the pain?",
      "Is the abdomen rigid or board-like?",
      "Any fever?",
      "Is the patient able to tolerate anything orally?",
      "Any previous episodes of similar pain?"
    ],
    "chief_complaint_patterns": [
      "Severe epigastric pain radiating to back + nausea/vomiting + tenderness — acute pancreatitis",
      "Upper abdominal pain + vomiting + fever + known gallstones",
      "Severe pancreatitis with shock, jaundice, and peritonism"
    ],
    "condition_mapping": [
      {"pattern": "severe epigastric pain + back radiation + elevated amylase/lipase", "suspected": "Acute Pancreatitis"},
      {"pattern": "pancreatitis + jaundice + fever", "suspected": "Gallstone Pancreatitis with Biliary Obstruction"},
      {"pattern": "pancreatitis + shock + Grey-Turner/Cullen sign", "suspected": "Severe Necrotising Pancreatitis"}
    ],
    "red_flags": ["haemodynamic shock", "jaundice with pancreatitis", "severe abdominal rigidity", "peritonism", "high fever"],
    "urgency_level": "Emergency",
    "forward_to": "108 Ambulance / ESIC Hospital with GI Surgery",
    "notes": "NBM. IV fluids essential. Ranson's / APACHE II scoring for severity. Severe pancreatitis has high mortality."
  },
  {
    "group_id": "GI_004",
    "group_name": "GASTROINTESTINAL CONDITIONS",
    "condition_name": "Acute Cholecystitis / Biliary Colic",
    "trigger_keywords": ["right upper stomach pain", "fatty food pain", "gallbladder pain", "jaundice with pain", "right side pain under ribs", "piliya ke saath dard"],
    "probing_questions": [
      "Is the pain in the right upper abdomen or under the right ribcage?",
      "Does it radiate to the right shoulder or back?",
      "Did it start after eating a fatty meal?",
      "Is there any jaundice (yellow skin/eyes)?",
      "Is there fever with the pain?",
      "Is the pain colicky (coming and going) or constant?",
      "Any previous similar episodes or known gallstones?"
    ],
    "chief_complaint_patterns": [
      "Right upper quadrant pain radiating to right shoulder after fatty meal + fever — cholecystitis",
      "Colicky right upper abdominal pain + jaundice + fever — Charcot's triad (cholangitis)",
      "Murphy's sign positive + right upper quadrant tenderness + nausea"
    ],
    "condition_mapping": [
      {"pattern": "RUQ pain + fever + post-fatty meal", "suspected": "Acute Cholecystitis"},
      {"pattern": "RUQ pain + jaundice + fever (Charcot's triad)", "suspected": "Ascending Cholangitis — Emergency"},
      {"pattern": "colicky RUQ pain + no fever + no jaundice", "suspected": "Biliary Colic"}
    ],
    "red_flags": ["Charcot's triad (pain + jaundice + fever)", "Reynold's pentad (adds confusion + shock)", "high fever + rigors"],
    "urgency_level": "Emergency (cholangitis) / Urgent (cholecystitis) / Routine (biliary colic)",
    "forward_to": "108 for cholangitis; ESIC Hospital for acute cholecystitis; ESIS Dispensary for biliary colic follow-up",
    "notes": "Ascending cholangitis (Charcot's triad) is life-threatening. Requires urgent ERCP and IV antibiotics."
  },
  {
    "group_id": "GI_005",
    "group_name": "GASTROINTESTINAL CONDITIONS",
    "condition_name": "Bowel Obstruction",
    "trigger_keywords": ["no stool for days", "vomiting brown vomit", "bloated belly", "no gas no stool", "abdominal distension", "vomiting faeculent"],
    "probing_questions": [
      "Has the patient passed any stool or gas recently?",
      "Is the abdomen distended and bloated?",
      "Is there vomiting — what colour?",
      "Is there colicky abdominal pain?",
      "Any previous abdominal surgeries?",
      "Any history of hernia?",
      "Is the patient elderly with a history of constipation?",
      "Any recent change in bowel habit or blood in stool?"
    ],
    "chief_complaint_patterns": [
      "No bowel movement or flatus for 3 days + vomiting + distended abdomen — obstruction",
      "Colicky central abdominal pain + vomiting + absolute constipation in post-operative patient — adhesion obstruction",
      "Elderly patient with colicky pain + blood in stool + constipation — colon cancer obstruction"
    ],
    "condition_mapping": [
      {"pattern": "absolute constipation + distension + colicky pain + vomiting", "suspected": "Mechanical Bowel Obstruction"},
      {"pattern": "bowel obstruction + tenderness + fever + peritonism", "suspected": "Strangulated Obstruction — Surgical Emergency"},
      {"pattern": "obstruction + history of colon cancer or change in bowel habits", "suspected": "Malignant Bowel Obstruction"}
    ],
    "red_flags": ["peritonism signs", "fever with obstruction", "haemodynamic shock", "previous cancer history"],
    "urgency_level": "Emergency",
    "forward_to": "108 Ambulance / ESIC Hospital with Surgery",
    "notes": "NBM. IV fluids. NG tube may be needed. Strangulation = bowel ischaemia = surgical emergency."
  },
  {
    "group_id": "OBS_001",
    "group_name": "OBSTETRIC / GYNAECOLOGICAL CONDITIONS",
    "condition_name": "Ectopic Pregnancy",
    "trigger_keywords": ["pregnancy pain one side", "missed period with pain", "shoulder tip pain pregnancy", "early pregnancy bleeding", "fallopian tube", "ectopic"],
    "probing_questions": [
      "Is the patient pregnant or could she be pregnant (missed period)?",
      "Is there pain on one side of the lower abdomen?",
      "Is there any vaginal bleeding or spotting?",
      "Is there shoulder tip pain (referred pain from diaphragm — blood in peritoneum)?",
      "Is the patient feeling faint or dizzy?",
      "How many weeks pregnant is she?",
      "Any previous ectopic pregnancy, fallopian tube surgery, or PID?"
    ],
    "chief_complaint_patterns": [
      "6-week pregnancy + sudden right iliac fossa pain + shoulder tip pain + vaginal spotting — ruptured ectopic",
      "Amenorrhoea + unilateral pelvic pain + haemodynamic instability — ruptured ectopic",
      "Positive pregnancy test + one-sided pain + dizziness + fainting"
    ],
    "condition_mapping": [
      {"pattern": "missed period + unilateral pain + vaginal bleeding + shoulder tip pain", "suspected": "Ectopic Pregnancy"},
      {"pattern": "ectopic + hypotension + syncope + peritonism", "suspected": "Ruptured Ectopic Pregnancy — Life-threatening haemorrhage"},
      {"pattern": "positive pregnancy test + pain + no intrauterine pregnancy on scan", "suspected": "Ectopic Pregnancy"}
    ],
    "red_flags": ["haemodynamic shock", "peritonism", "shoulder tip pain", "syncope in early pregnancy"],
    "urgency_level": "Emergency",
    "forward_to": "108 Ambulance / ESIC Hospital with Gynaecology and OT",
    "notes": "Ruptured ectopic = surgical emergency with haemorrhagic shock. Call 108 immediately. Any woman of reproductive age with abdominal pain and a missed period must have ectopic excluded."
  },
  {
    "group_id": "OBS_002",
    "group_name": "OBSTETRIC / GYNAECOLOGICAL CONDITIONS",
    "condition_name": "Eclampsia / Pre-eclampsia",
    "trigger_keywords": ["fits in pregnancy", "convulsion pregnant", "high BP pregnancy", "preeclampsia", "swelling fits pregnant", "pregnancy seizure", "pregnant haath paon sujan"],
    "probing_questions": [
      "How many weeks pregnant is she?",
      "Is there a history of high blood pressure during this pregnancy?",
      "Is there swelling of face, hands, or feet?",
      "Has she had a seizure? Is this the first?",
      "Does she have a severe headache or visual disturbances (flashing lights)?",
      "Is there pain in the upper abdomen, especially on the right side?",
      "Is the baby still moving?",
      "Any protein in urine detected at last check?"
    ],
    "chief_complaint_patterns": [
      "Pregnant woman >20 weeks + seizure + known high blood pressure — eclampsia",
      "Severe headache + visual disturbances + high BP + proteinuria + oedema — severe pre-eclampsia",
      "Post-partum seizure with hypertension in previously healthy woman — post-partum eclampsia"
    ],
    "condition_mapping": [
      {"pattern": "pregnancy >20 weeks + seizure + hypertension", "suspected": "Eclampsia"},
      {"pattern": "hypertension + proteinuria + severe headache + visual disturbance", "suspected": "Severe Pre-eclampsia"},
      {"pattern": "RUQ pain + elevated liver enzymes + thrombocytopenia + pregnancy", "suspected": "HELLP Syndrome"}
    ],
    "red_flags": ["seizure in pregnancy", "very high BP >160/110", "visual disturbances", "RUQ pain in pregnancy", "reduced fetal movements"],
    "urgency_level": "Emergency",
    "forward_to": "108 Ambulance / ESIC Hospital with Obstetrics / Labour Room",
    "notes": "Magnesium sulphate is first-line anticonvulsant. Antihypertensives urgently needed. Baby may need emergency delivery. Call 108."
  },
  {
    "group_id": "OBS_003",
    "group_name": "OBSTETRIC / GYNAECOLOGICAL CONDITIONS",
    "condition_name": "Postpartum Haemorrhage (PPH)",
    "trigger_keywords": ["bleeding after delivery", "excessive bleeding childbirth", "prasav ke baad khoon", "postnatal bleeding", "PPH", "uterus not contracting after birth"],
    "probing_questions": [
      "When did she deliver? How long ago?",
      "How much blood has been lost — is it soaking through multiple pads?",
      "Is she feeling faint or losing consciousness?",
      "Was the placenta delivered completely?",
      "Is the uterus soft (atonic) or firm?",
      "Was this a normal delivery or caesarean?",
      "Any tear or laceration during delivery?",
      "Any history of previous PPH, fibroids, or blood clotting disorder?"
    ],
    "chief_complaint_patterns": [
      "Massive vaginal bleeding within 24 hours of delivery with haemodynamic collapse",
      "Uterine atony — soft boggy uterus with heavy postpartum bleeding",
      "Secondary PPH: heavy bleeding 5–14 days after delivery with fever — retained products"
    ],
    "condition_mapping": [
      {"pattern": "heavy bleeding <24h post-delivery + soft uterus + shock", "suspected": "Primary PPH — Uterine Atony"},
      {"pattern": "heavy bleeding + incomplete placenta delivery", "suspected": "PPH — Retained Placenta"},
      {"pattern": "bleeding >24h post-delivery + fever + offensive discharge", "suspected": "Secondary PPH — Endometritis / Retained Products"}
    ],
    "red_flags": ["haemodynamic shock", "pallor and weakness", "loss of consciousness", "blood soaking multiple pads rapidly"],
    "urgency_level": "Emergency",
    "forward_to": "108 Ambulance / ESIC Hospital with Obstetrics and Blood Bank",
    "notes": "Primary PPH: >500ml blood loss. Oxytocin, bimanual compression, call 108. Blood transfusion may be needed."
  },
  {
    "group_id": "OBS_004",
    "group_name": "OBSTETRIC / GYNAECOLOGICAL CONDITIONS",
    "condition_name": "Placenta Praevia / Antepartum Haemorrhage",
    "trigger_keywords": ["painless bleeding pregnancy", "bleeding third trimester", "bleeding without pain pregnant", "placenta low", "antepartum bleeding"],
    "probing_questions": [
      "How many weeks pregnant is she?",
      "Is the bleeding painful or painless?",
      "How much bleeding — light spotting or heavy like a period?",
      "Has this happened before in this pregnancy?",
      "Was a low-lying placenta detected on ultrasound?",
      "Is the baby moving normally?",
      "Is she having any contractions?",
      "Any recent sexual intercourse or physical activity before the bleed?"
    ],
    "chief_complaint_patterns": [
      "Painless bright red vaginal bleeding at 32 weeks — suspected placenta praevia",
      "Painful heavy bleeding in third trimester + uterine rigidity — placental abruption",
      "Recurrent antepartum bleeds in patient with confirmed low-lying placenta"
    ],
    "condition_mapping": [
      {"pattern": "painless bright red bleeding + third trimester", "suspected": "Placenta Praevia"},
      {"pattern": "painful bleeding + rigid uterus + fetal distress signs", "suspected": "Placental Abruption"},
      {"pattern": "APH + haemodynamic instability", "suspected": "Major APH — Emergency Delivery required"}
    ],
    "red_flags": ["heavy bleeding", "haemodynamic shock", "reduced fetal movements", "uterine rigidity"],
    "urgency_level": "Emergency",
    "forward_to": "108 Ambulance / ESIC Hospital with Obstetrics and Blood Bank",
    "notes": "No vaginal examination in suspected placenta praevia. Call 108. Urgent obstetric review."
  },
  {
    "group_id": "OBS_005",
    "group_name": "OBSTETRIC / GYNAECOLOGICAL CONDITIONS",
    "condition_name": "Ovarian Torsion",
    "trigger_keywords": ["sudden pelvic pain", "ovarian cyst pain", "one side severe pain woman", "nausea vomiting pelvic pain", "ovarial dard"],
    "probing_questions": [
      "Is the pain sudden and severe on one side of the lower abdomen?",
      "Is there nausea and vomiting with the pain?",
      "Any history of ovarian cyst?",
      "Was there any recent vigorous exercise or sudden movement before onset?",
      "Any fever?",
      "Is the patient pregnant?",
      "Is the pain constant or intermittent?"
    ],
    "chief_complaint_patterns": [
      "Sudden severe unilateral lower abdominal pain + vomiting + known ovarian cyst",
      "Acute onset right iliac fossa pain + nausea in a woman — torsion vs appendicitis",
      "Intermittent severe pelvic pain with nausea suggesting partial torsion"
    ],
    "condition_mapping": [
      {"pattern": "sudden severe unilateral pelvic pain + vomiting + ovarian cyst history", "suspected": "Ovarian Torsion"},
      {"pattern": "torsion + fever + peritonism", "suspected": "Ovarian Torsion with Ischaemia/Necrosis"},
      {"pattern": "acute pelvic pain + positive pregnancy test + no intrauterine pregnancy", "suspected": "Ectopic Pregnancy (differential)"}
    ],
    "red_flags": ["peritonism", "haemodynamic instability", "fever with severe pelvic pain"],
    "urgency_level": "Emergency",
    "forward_to": "108 Ambulance / ESIC Hospital with Gynaecology and OT",
    "notes": "Ovarian torsion requires urgent surgical detorsion. Delay can lead to ovarian necrosis."
  },
  {
    "group_id": "PAED_001",
    "group_name": "PAEDIATRIC CONDITIONS",
    "condition_name": "Febrile Seizures",
    "trigger_keywords": ["child fits with fever", "baby convulsion", "bachche ko fever mein mirgi", "child shaking with high fever", "baby fitting"],
    "probing_questions": [
      "How old is the child?",
      "Did the fit start within 24 hours of fever onset?",
      "How long did the fit last?",
      "Was it generalised (whole body) or only one side?",
      "Has the child had fits before — with or without fever?",
      "Is the child conscious and responsive now?",
      "Is there neck stiffness?",
      "Is there any rash?",
      "Is the child up to date with vaccines — especially meningococcal?"
    ],
    "chief_complaint_patterns": [
      "18-month-old with generalised tonic-clonic fit lasting 2 minutes with high fever — simple febrile seizure",
      "4-year-old with prolonged focal seizure >15 minutes with fever — complex febrile seizure",
      "First febrile seizure in 9-month-old — exclude meningitis"
    ],
    "condition_mapping": [
      {"pattern": "generalised fit <15 min + fever + age 6m–5y + normal post-ictally", "suspected": "Simple Febrile Seizure"},
      {"pattern": "prolonged fit >15 min or focal or recurrent in 24h + fever", "suspected": "Complex Febrile Seizure — exclude meningitis"},
      {"pattern": "fit + fever + neck stiffness + bulging fontanelle", "suspected": "Bacterial Meningitis — Emergency"}
    ],
    "red_flags": ["fit >5 minutes", "focal seizure", "not recovering after fit", "neck stiffness", "non-blanching rash", "age <6 months with first febrile seizure"],
    "urgency_level": "Emergency",
    "forward_to": "108 Ambulance / ESIC Hospital Paediatrics",
    "notes": "Simple febrile seizures are generally benign but must exclude meningitis. First febrile seizure always needs hospital assessment."
  },
  {
    "group_id": "PAED_002",
    "group_name": "PAEDIATRIC CONDITIONS",
    "condition_name": "Croup (Acute Laryngotracheobronchitis)",
    "trigger_keywords": ["barking cough child", "seal cough baby", "noisy breathing child night", "kuti jaisi khansi", "stridor child", "child breathing difficulty night"],
    "probing_questions": [
      "How old is the child?",
      "Does the cough sound like a barking seal or dog?",
      "Is there a high-pitched noise when the child breathes in (inspiratory stridor)?",
      "Is the child distressed, drooling, or sitting forward (may suggest epiglottitis)?",
      "Is there fever?",
      "Is the child's colour normal or is there blueness?",
      "Does it worsen when the child cries or is upset?",
      "Is there any improvement when taken outside in cool air?"
    ],
    "chief_complaint_patterns": [
      "2-year-old with barking cough + inspiratory stridor + mild fever — mild croup",
      "Child with severe stridor at rest + intercostal recession + distress — severe croup",
      "Child sitting upright, drooling, with high fever + severe stridor — exclude epiglottitis"
    ],
    "condition_mapping": [
      {"pattern": "barking cough + inspiratory stridor + fever + age 6m–3y", "suspected": "Viral Croup (Laryngotracheitis)"},
      {"pattern": "child sitting forward + drooling + high fever + muffled voice + toxic", "suspected": "Acute Epiglottitis — Emergency"},
      {"pattern": "stridor + persistent despite treatment + very young infant", "suspected": "Foreign body vs Subglottic Stenosis"}
    ],
    "red_flags": ["drooling + high fever + sitting forward (epiglottitis)", "cyanosis", "stridor at rest", "severe recession", "rapidly worsening"],
    "urgency_level": "Emergency (severe croup/epiglottitis) / Urgent (mild croup)",
    "forward_to": "108 for severe; ESIC Hospital Paediatrics for moderate/mild",
    "notes": "Do NOT examine the throat if epiglottitis suspected — can precipitate complete airway obstruction. Call 108 for any child with drooling + high fever + stridor."
  },
  {
    "group_id": "PAED_003",
    "group_name": "PAEDIATRIC CONDITIONS",
    "condition_name": "Paediatric Intussusception",
    "trigger_keywords": ["baby crying pain comes goes", "jelly stool baby", "baby drawing legs up pain", "infant colicky pain", "bloody stool baby", "infant red stool"],
    "probing_questions": [
      "How old is the baby?",
      "Is the crying episodic — does it come every 15–20 minutes?",
      "Does the baby draw up their legs during the crying episodes?",
      "Has there been any blood or mucus in the stool (red-currant jelly stool)?",
      "Is there vomiting?",
      "Is there a mass palpable in the abdomen?",
      "Is the baby becoming progressively more lethargic or pale?"
    ],
    "chief_complaint_patterns": [
      "3-month to 2-year-old with episodic severe crying + legs drawn up + red currant jelly stool",
      "Infant with colicky pain + vomiting + sausage-shaped abdominal mass",
      "Lethargy + pale infant + episodes of screaming — late intussusception"
    ],
    "condition_mapping": [
      {"pattern": "episodic colicky pain + legs drawn up + red-currant jelly stool + young infant", "suspected": "Intussusception"},
      {"pattern": "intussusception + peritonism + shock + late presentation", "suspected": "Complicated Intussusception with bowel ischaemia"},
      {"pattern": "infant intussusception + preceding viral illness", "suspected": "Ileocolic Intussusception (most common)"}
    ],
    "red_flags": ["haemodynamic shock", "peritonism in infant", "bile-stained vomiting", "progressive lethargy"],
    "urgency_level": "Emergency",
    "forward_to": "108 Ambulance / ESIC Hospital with Paediatric Surgery",
    "notes": "Air enema (pneumatic reduction) is treatment of choice. Surgical emergency if bowel necrosis. Urgently refer."
  },
  {
    "group_id": "PAED_004",
    "group_name": "PAEDIATRIC CONDITIONS",
    "condition_name": "Neonatal Sepsis",
    "trigger_keywords": ["newborn not feeding", "baby looks sick", "navjat bachche ko bukhar", "newborn fever", "neonatal jaundice with fever", "baby very sleepy not waking"],
    "probing_questions": [
      "How old is the baby — days or weeks?",
      "Is the baby feeding well or refusing feeds?",
      "Is the baby unusually sleepy or difficult to wake?",
      "Is there fever or low temperature (hypothermia)?",
      "Is there yellowing of the skin (jaundice)?",
      "Was there prolonged rupture of membranes or maternal fever during delivery?",
      "Is the breathing fast or laboured?",
      "Are there any rashes, pustules, or discharge from the umbilical cord?"
    ],
    "chief_complaint_patterns": [
      "3-day-old baby not feeding, lethargic, temperature instability — early-onset neonatal sepsis",
      "2-week-old with fever, fast breathing, and jaundice — late-onset sepsis",
      "Newborn with umbilical redness, purulent discharge, and lethargy — omphalitis leading to sepsis"
    ],
    "condition_mapping": [
      {"pattern": "newborn not feeding + lethargy + temperature instability <7 days", "suspected": "Early-Onset Neonatal Sepsis (GBS / E.coli)"},
      {"pattern": "newborn fever + fast breathing + jaundice >7 days", "suspected": "Late-Onset Neonatal Sepsis"},
      {"pattern": "umbilical redness/discharge + sick-looking newborn", "suspected": "Omphalitis with Sepsis"}
    ],
    "red_flags": ["any sick-looking newborn <28 days", "temperature instability", "poor feeding", "fast breathing", "unusual skin colour"],
    "urgency_level": "Emergency",
    "forward_to": "108 Ambulance / ESIC Hospital Neonatal ICU (NICU)",
    "notes": "Any sick-looking baby <1 month is an emergency. Do NOT wait. IV antibiotics within 1 hour of recognition can be life-saving."
  },
  {
    "group_id": "ENDO_001",
    "group_name": "ENDOCRINE CONDITIONS",
    "condition_name": "Diabetic Ketoacidosis (DKA)",
    "trigger_keywords": ["diabetic unconscious", "fruity breath diabetic", "vomiting diabetic", "blood sugar very high", "DKA", "madhumeh coma", "diabetes very sick"],
    "probing_questions": [
      "Is the person diabetic — Type 1 or Type 2?",
      "What is the blood sugar reading — is it very high?",
      "Is there vomiting and abdominal pain?",
      "Is the person breathing deeply and rapidly (Kussmaul respiration)?",
      "Is there a fruity or acetone smell on their breath?",
      "Is the patient confused or drowsy?",
      "Have they missed any insulin doses?",
      "Any recent illness, infection, or fever (precipitant)?"
    ],
    "chief_complaint_patterns": [
      "Type 1 diabetic with very high blood sugar + vomiting + deep rapid breathing + fruity breath — DKA",
      "Known diabetic with abdominal pain + ketones in urine + blood sugar >14 mmol/L",
      "Young patient, new diagnosis of T1DM, presenting with DKA as first presentation"
    ],
    "condition_mapping": [
      {"pattern": "high blood glucose + ketones + acidosis + vomiting", "suspected": "Diabetic Ketoacidosis (DKA)"},
      {"pattern": "very high blood glucose + no ketones + altered consciousness + elderly T2DM", "suspected": "Hyperosmolar Hyperglycaemic State (HHS)"},
      {"pattern": "high glucose + Kussmaul breathing + fruity breath + dehydration", "suspected": "DKA — Emergency"}
    ],
    "red_flags": ["altered consciousness", "severe vomiting and dehydration", "Kussmaul breathing", "blood glucose >25 mmol/L", "shock"],
    "urgency_level": "Emergency",
    "forward_to": "108 Ambulance / ESIC Hospital with ICU/HDU",
    "notes": "IV fluids + insulin infusion is life-saving. Treat underlying cause. Monitor K+ carefully — risk of hypokalaemia with insulin."
  },
  {
    "group_id": "ENDO_002",
    "group_name": "ENDOCRINE CONDITIONS",
    "condition_name": "Severe Hypoglycaemia",
    "trigger_keywords": ["diabetic unconscious", "low sugar", "shakkar kam", "insulin overdose", "diabetic collapsed", "sweating diabetic confused", "sugar drop"],
    "probing_questions": [
      "Is the patient diabetic? Do they take insulin or sulphonylurea tablets?",
      "What is the blood glucose reading?",
      "Is the patient conscious, confused, or unconscious?",
      "Is there sweating, trembling, or pale skin?",
      "When did they last eat?",
      "Did they take an extra dose of insulin or miss a meal?",
      "Are they on any other medications?"
    ],
    "chief_complaint_patterns": [
      "Diabetic patient found unconscious, sweating — blood glucose 1.8 mmol/L",
      "Insulin-dependent diabetic confused and aggressive after missing a meal",
      "Elderly sulphonylurea patient with prolonged hypoglycaemia after reduced food intake"
    ],
    "condition_mapping": [
      {"pattern": "diabetic + unconscious + low blood glucose + sweating", "suspected": "Severe Hypoglycaemia"},
      {"pattern": "diabetic + seizure + blood glucose <2.5 mmol/L", "suspected": "Hypoglycaemic Seizure"},
      {"pattern": "confusion + sweating + tremor in non-diabetic", "suspected": "Insulinoma / Factitious hypoglycaemia"}
    ],
    "red_flags": ["unconscious", "seizure", "blood glucose <3 mmol/L", "unable to swallow safely"],
    "urgency_level": "Emergency",
    "forward_to": "108 Ambulance / ESIC Hospital Casualty",
    "notes": "If conscious and able to swallow: give oral glucose/sugar/juice. If unconscious: Call 108. IV dextrose or IM glucagon required. Do NOT give anything by mouth to unconscious patient."
  },
  {
    "group_id": "ENDO_003",
    "group_name": "ENDOCRINE CONDITIONS",
    "condition_name": "Thyroid Storm (Thyrotoxic Crisis)",
    "trigger_keywords": ["thyroid crisis", "fast heart hyperthyroid", "thyroid very high", "goitre crisis", "high fever fast heart thyroid patient"],
    "probing_questions": [
      "Is there a known history of hyperthyroidism or goitre?",
      "Is there extremely rapid heart rate (>140 bpm)?",
      "Is there very high fever?",
      "Is there agitation, confusion, or psychosis?",
      "Any recent thyroid surgery, radioiodine, or contrast dye exposure?",
      "Any severe diarrhoea and vomiting?",
      "Is there excessive sweating and weight loss?"
    ],
    "chief_complaint_patterns": [
      "Known hyperthyroid patient with very high fever + rapid AF + confusion after surgery — thyroid storm",
      "Extremely fast heart rate + hyperthermia + agitation in goitre patient",
      "Multi-organ failure with fever + tachycardia + jaundice in hyperthyroid patient"
    ],
    "condition_mapping": [
      {"pattern": "hyperthyroid + fever >40°C + heart rate >140 + confusion", "suspected": "Thyroid Storm (Burch-Wartofsky score >45)"},
      {"pattern": "AF + fast rate + known thyroid disease + fever", "suspected": "Thyrotoxicosis with AF"},
      {"pattern": "thyroid crisis + cardiac failure + coma", "suspected": "Severe Thyroid Storm with multi-organ failure"}
    ],
    "red_flags": ["fever >40°C", "heart rate >140", "altered consciousness", "cardiac arrhythmia"],
    "urgency_level": "Emergency",
    "forward_to": "108 Ambulance / ESIC Hospital with ICU",
    "notes": "Thyroid storm has 20-30% mortality. Requires propylthiouracil, beta-blockers, iodine, hydrocortisone, and ICU care."
  },
  {
    "group_id": "ENDO_004",
    "group_name": "ENDOCRINE CONDITIONS",
    "condition_name": "Adrenal Crisis",
    "trigger_keywords": ["steroid dependent collapsed", "addison crisis", "shock steroid patient", "adrenal failure", "steroid suddenly stopped"],
    "probing_questions": [
      "Does the patient take steroid (prednisolone/dexamethasone) tablets regularly?",
      "Did they suddenly stop or reduce their steroids?",
      "Is there profound weakness, nausea, or vomiting?",
      "Is the blood pressure very low?",
      "Is there fever suggesting infection as a precipitant?",
      "Any abdominal pain?",
      "Is there confusion or altered consciousness?",
      "Any known history of Addison's disease or adrenal insufficiency?"
    ],
    "chief_complaint_patterns": [
      "Known Addison's disease patient with vomiting + collapse + hypotension after intercurrent illness",
      "Steroid-dependent patient who missed doses + profound weakness + BP very low",
      "Unexplained hypotension + hyponatraemia + hyperkalaemia in ill patient"
    ],
    "condition_mapping": [
      {"pattern": "steroid user + precipitant illness + hypotension + vomiting", "suspected": "Adrenal Crisis"},
      {"pattern": "hypotension + hyponatraemia + hyperkalaemia + hyperpigmentation", "suspected": "Addison's Disease / Adrenal Insufficiency"},
      {"pattern": "critically ill patient on steroids who suddenly deteriorates", "suspected": "Relative Adrenal Insufficiency in Critical Illness"}
    ],
    "red_flags": ["haemodynamic shock", "altered consciousness", "profound weakness", "electrolyte abnormalities"],
    "urgency_level": "Emergency",
    "forward_to": "108 Ambulance / ESIC Hospital with ICU",
    "notes": "IV hydrocortisone 100 mg is life-saving and should not be delayed. IV fluids essential. Treat precipitant."
  },
  {
    "group_id": "RENAL_001",
    "group_name": "RENAL / UROLOGICAL CONDITIONS",
    "condition_name": "Renal Colic (Ureteric Stone)",
    "trigger_keywords": ["loin pain", "kidney stone", "back pain going to groin", "pathri", "side pain going down", "passing stone", "peshab mein dard pathri"],
    "probing_questions": [
      "Where exactly is the pain — one side of the back/flank, going to the groin?",
      "Is the pain colicky — severe waves of pain?",
      "Is there blood in the urine?",
      "Is there vomiting with the pain?",
      "Any fever or rigors?",
      "Any previous kidney stones?",
      "Is the patient unable to find a comfortable position?",
      "Any difficulty passing urine?"
    ],
    "chief_complaint_patterns": [
      "Severe colicky left flank pain radiating to groin + haematuria — ureteric colic",
      "Loin pain + fever + rigors + vomiting — obstructed infected kidney (emergency)",
      "Known stone former with typical severe unilateral flank pain"
    ],
    "condition_mapping": [
      {"pattern": "colicky loin-to-groin pain + haematuria + vomiting + no fever", "suspected": "Ureteric Colic / Renal Stone"},
      {"pattern": "ureteric colic + fever + rigors + unilateral loin pain", "suspected": "Obstructed Infected Kidney — Urological Emergency"},
      {"pattern": "loin pain + haematuria + no colic + elderly", "suspected": "Renal Cell Carcinoma (less urgent but must investigate)"}
    ],
    "red_flags": ["fever with loin pain (obstructed infected kidney)", "single kidney with obstruction", "acute kidney injury", "intractable vomiting"],
    "urgency_level": "Emergency (infected obstruction) / Urgent (uncomplicated colic)",
    "forward_to": "108 for infected obstruction; ESIC Hospital Urology for uncomplicated colic",
    "notes": "Obstructed infected kidney = urological emergency requiring urgent drainage (nephrostomy or ureteric stent). Do NOT delay."
  },
  {
    "group_id": "RENAL_002",
    "group_name": "RENAL / UROLOGICAL CONDITIONS",
    "condition_name": "Testicular Torsion",
    "trigger_keywords": ["sudden testis pain", "anda mein dard", "testicular torsion", "sudden scrotal pain boy", "scrotal swelling pain sudden"],
    "probing_questions": [
      "How old is the patient?",
      "When did the pain start — was it sudden?",
      "Is the testis swollen and very tender?",
      "Is the testis riding high or at an unusual angle?",
      "Is there nausea and vomiting with the pain?",
      "Any recent trauma to the area?",
      "Any previous episodes of similar pain that resolved on its own?"
    ],
    "chief_complaint_patterns": [
      "Teenage boy with sudden severe right testicular pain + high-riding testis + vomiting",
      "Adolescent male with acute scrotal pain and swelling — torsion until proven otherwise",
      "Intermittent episodes of scrotal pain that resolve spontaneously — torsion-detorsion"
    ],
    "condition_mapping": [
      {"pattern": "sudden severe scrotal pain + high-riding testis + adolescent", "suspected": "Testicular Torsion — Surgical Emergency"},
      {"pattern": "gradual scrotal swelling + fever + dysuria + adult", "suspected": "Epididymo-orchitis (differential)"},
      {"pattern": "neonatal scrotal swelling + discolouration", "suspected": "Neonatal Testicular Torsion"}
    ],
    "red_flags": ["sudden onset severe pain", "high-riding testis", "nausea/vomiting with scrotal pain", "time since onset >6 hours"],
    "urgency_level": "Emergency",
    "forward_to": "108 Ambulance / ESIC Hospital with Urology / Surgery",
    "notes": "Viability of testis is time-critical. >6 hours = >50% risk of loss. Surgical detorsion required. Call 108 immediately."
  },
  {
    "group_id": "RENAL_003",
    "group_name": "RENAL / UROLOGICAL CONDITIONS",
    "condition_name": "Acute Kidney Injury (AKI)",
    "trigger_keywords": ["not passing urine", "kidney failure", "peshab kam ho gaya", "dialysis patient sick", "creatinine very high", "swelling and no urine"],
    "probing_questions": [
      "Has the urine output significantly decreased or stopped?",
      "Is there swelling of the legs or face?",
      "Any history of kidney disease, diabetes, or hypertension?",
      "Any recent diarrhoea and vomiting causing dehydration?",
      "Any recent use of NSAIDs, contrast dye, or antibiotics (nephrotoxins)?",
      "Any recent illness or infection?",
      "Is the patient confused or very drowsy?",
      "Any muscle injury or rhabdomyolysis (dark tea-coloured urine)?"
    ],
    "chief_complaint_patterns": [
      "Severely reduced urine output + leg swelling + creatinine rapidly rising — AKI",
      "Dehydrated patient with gastroenteritis + no urine output for 12 hours — prerenal AKI",
      "Post-contrast dye administration + rising creatinine — contrast nephropathy"
    ],
    "condition_mapping": [
      {"pattern": "decreased urine output + rising creatinine + dehydration", "suspected": "Pre-renal AKI"},
      {"pattern": "dark urine + muscle pain + recent crush/exertion + rising creatinine", "suspected": "AKI due to Rhabdomyolysis"},
      {"pattern": "AKI + hyperkalaemia + acidosis + oliguria", "suspected": "AKI requiring urgent dialysis consideration"}
    ],
    "red_flags": ["no urine output", "hyperkalaemia (ECG changes)", "pulmonary oedema", "altered consciousness"],
    "urgency_level": "Emergency (severe) / Urgent (mild)",
    "forward_to": "108 for severe; ESIC Hospital Nephrology for moderate",
    "notes": "Hyperkalaemia with ECG changes = cardiac emergency within AKI. Urgent dialysis may be required."
  },
  {
    "group_id": "TROPICAL_001",
    "group_name": "TROPICAL / INFECTIOUS (INDIA-SPECIFIC)",
    "condition_name": "Dengue Haemorrhagic Fever",
    "trigger_keywords": ["dengue", "dengue fever", "high fever rash platelets low", "dengue shock", "dengue with bleeding", "dangu bukhar", "platelets gir rahe hain"],
    "probing_questions": [
      "Has the patient been diagnosed with dengue?",
      "Is there bleeding — from gums, nose, urine, or in stool?",
      "What is the platelet count?",
      "Is the patient in dengue-endemic area (Assam, NE India)?",
      "Is there severe abdominal pain or pain on pressing the liver area?",
      "Is the patient persistently vomiting?",
      "Is the patient feeling very weak, dizzy, or has collapsed?",
      "Is there rapid breathing or cold clammy skin?",
      "Is there any internal or external bleeding?"
    ],
    "chief_complaint_patterns": [
      "Dengue patient day 4-5 with dropping platelet count + bleeding gums + severe abdominal pain — DHF",
      "Dengue with cold clammy skin + low BP + rapid heart rate — Dengue Shock Syndrome",
      "Dengue fever + massive pleural effusion or ascites + haematuria"
    ],
    "condition_mapping": [
      {"pattern": "dengue fever + bleeding + platelet <20,000 + haemodynamic instability", "suspected": "Dengue Haemorrhagic Fever (DHF) / Dengue Shock Syndrome"},
      {"pattern": "dengue day 3-6 + severe abdominal pain + vomiting + lethargy", "suspected": "Dengue with Warning Signs — Hospitalise immediately"},
      {"pattern": "dengue fever + fluid leakage + shock", "suspected": "Dengue Shock Syndrome (DSS)"}
    ],
    "red_flags": ["platelet <20,000", "any bleeding manifestation", "cold clammy skin", "persistent vomiting", "severe abdominal pain", "altered consciousness"],
    "urgency_level": "Emergency",
    "forward_to": "108 Ambulance / ESIC Hospital with ICU",
    "notes": "WHO Dengue Warning Signs must be identified. IV fluid resuscitation is the mainstay. Platelet transfusion only for active bleeding or <10,000. Report to IDSP as notifiable disease."
  },
  {
    "group_id": "TROPICAL_002",
    "group_name": "TROPICAL / INFECTIOUS (INDIA-SPECIFIC)",
    "condition_name": "Cerebral Malaria (Severe Malaria with Neurological Complications)",
    "trigger_keywords": ["malaria with unconscious", "paludism with fits", "malaria bukhar aur behoshi", "cerebral malaria", "malaria fits", "high fever with fits rural"],
    "probing_questions": [
      "Has the patient been tested for malaria — is it positive?",
      "Is the patient conscious and oriented?",
      "Are there seizures?",
      "How high is the fever?",
      "Is there jaundice?",
      "Is there dark urine (blackwater fever)?",
      "Is the patient from a tribal or rural area with poor access to care?",
      "Is there a history of travel to forested areas?"
    ],
    "chief_complaint_patterns": [
      "Positive P. falciparum malaria + altered consciousness + seizures — cerebral malaria",
      "Malaria + jaundice + dark urine + renal failure — severe malaria multi-organ involvement",
      "High fever + unconsciousness in tribal area worker — malaria until proven otherwise"
    ],
    "condition_mapping": [
      {"pattern": "malaria + unconsciousness + seizures + fever", "suspected": "Cerebral Malaria (P. falciparum)"},
      {"pattern": "malaria + jaundice + dark urine + oliguria", "suspected": "Severe Malaria with Renal Failure (Blackwater Fever)"},
      {"pattern": "malaria + severe anaemia + respiratory distress", "suspected": "Severe Malaria with Anaemia/ARDS"}
    ],
    "red_flags": ["altered consciousness", "seizures", "jaundice with malaria", "dark urine", "respiratory distress", "haemoglobin <7 g/dL"],
    "urgency_level": "Emergency",
    "forward_to": "108 Ambulance / ESIC Hospital / Government Malaria Treatment Centre",
    "notes": "IV artesunate is first-line for severe malaria. Notifiable disease under IDSP. Endemic in Assam. Report immediately."
  },
  {
    "group_id": "TROPICAL_003",
    "group_name": "TROPICAL / INFECTIOUS (INDIA-SPECIFIC)",
    "condition_name": "Typhoid with Complications",
    "trigger_keywords": ["typhoid fever long", "enteric fever", "typhoid with hole in stomach", "typhoid intestinal bleed", "stepladder fever", "typhoid very sick"],
    "probing_questions": [
      "Has the patient been diagnosed with typhoid?",
      "How long has the fever been present?",
      "Is there abdominal pain — especially sudden severe pain suggesting perforation?",
      "Any blood in stool or black tarry stool?",
      "Is the patient very weak or confused?",
      "Any rose-spot rash on the abdomen?",
      "Is the patient from an area with poor sanitation?",
      "Any recent changes in their condition after initially improving?"
    ],
    "chief_complaint_patterns": [
      "Known typhoid patient suddenly developing severe abdominal pain + peritonism — bowel perforation",
      "Typhoid week 3 with bloody stool + haemodynamic instability — intestinal haemorrhage",
      "Typhoid with persistent high fever + delirium + relative bradycardia"
    ],
    "condition_mapping": [
      {"pattern": "typhoid + sudden severe abdominal pain + peritonism + perforation signs", "suspected": "Typhoid Intestinal Perforation — Surgical Emergency"},
      {"pattern": "typhoid + massive bloody stool + haemodynamic instability", "suspected": "Typhoid Intestinal Haemorrhage"},
      {"pattern": "typhoid + delirium + severe headache + meningism", "suspected": "Typhoid with CNS Involvement / Meningitis"}
    ],
    "red_flags": ["sudden severe abdominal pain in typhoid patient", "bloody stool with typhoid", "delirium", "haemodynamic shock"],
    "urgency_level": "Emergency",
    "forward_to": "108 Ambulance / ESIC Hospital with Surgery",
    "notes": "Typhoid perforation has very high mortality without emergency surgery. Notifiable disease. IV antibiotics (ceftriaxone) essential."
  },
  {
    "group_id": "TROPICAL_004",
    "group_name": "TROPICAL / INFECTIOUS (INDIA-SPECIFIC)",
    "condition_name": "Leptospirosis",
    "trigger_keywords": ["fever after flood water", "Well's disease", "yellow fever after rain", "fever with red eyes and jaundice", "leptospira", "flood fever Assam"],
    "probing_questions": [
      "Has the patient been exposed to flood water, muddy water, or worked near animals recently?",
      "Is there fever with severe muscle pain (especially calf muscles)?",
      "Is there jaundice with the fever?",
      "Are the eyes red (conjunctival suffusion)?",
      "Is there bleeding — from gums, in urine, in stool?",
      "Is there reduced urine output (renal involvement)?",
      "Any headache and meningism?",
      "Is the patient from Assam flood-prone areas?"
    ],
    "chief_complaint_patterns": [
      "Fever + severe calf pain + red eyes + jaundice + exposure to flood water — Weil's disease",
      "Post-monsoon flood-area patient with fever + myalgia + renal failure + bleeding",
      "Biphasic fever with jaundice + haemorrhage + meningism — severe leptospirosis"
    ],
    "condition_mapping": [
      {"pattern": "flood water exposure + fever + jaundice + renal failure + bleeding", "suspected": "Weil's Disease (Severe Leptospirosis)"},
      {"pattern": "fever + myalgia + red eyes + no jaundice + flood area", "suspected": "Mild Leptospirosis (Anicteric)"},
      {"pattern": "leptospirosis + pulmonary haemorrhage + ARDS", "suspected": "Pulmonary Leptospirosis — High mortality"}
    ],
    "red_flags": ["jaundice with renal failure", "pulmonary haemorrhage", "altered consciousness", "haemodynamic shock"],
    "urgency_level": "Emergency",
    "forward_to": "108 Ambulance / ESIC Hospital with ICU",
    "notes": "Endemic in Assam especially during and after floods. Penicillin G or doxycycline is treatment. Report to IDSP as notifiable disease."
  },
  {
    "group_id": "TROPICAL_005",
    "group_name": "TROPICAL / INFECTIOUS (INDIA-SPECIFIC)",
    "condition_name": "Scrub Typhus",
    "trigger_keywords": ["fever after field work", "eschar fever", "scrub typhus", "jhadi mein kaam ke baad bukhar", "mite bite fever", "fever with skin sore Assam"],
    "probing_questions": [
      "Has the patient worked in fields, forests, or scrubland recently?",
      "Is there a painless black scab (eschar) anywhere on the body — often hidden in skin folds?",
      "Is there high fever with headache and body ache?",
      "Is there a rash spreading on the trunk?",
      "Is the patient confused or altered in consciousness?",
      "Is there cough or respiratory difficulty?",
      "Any jaundice?"
    ],
    "chief_complaint_patterns": [
      "Farmer from Assam with fever + eschar + headache + rash — scrub typhus",
      "Fever not responding to standard antibiotics + eschar on body + Assam/NE India",
      "Scrub typhus with meningoencephalitis and multi-organ failure"
    ],
    "condition_mapping": [
      {"pattern": "fever + eschar + headache + rural Assam", "suspected": "Scrub Typhus (Orientia tsutsugamushi)"},
      {"pattern": "fever + eschar + confusion + meningism", "suspected": "Scrub Typhus Meningoencephalitis"},
      {"pattern": "fever + eschar + ARDS + multi-organ failure", "suspected": "Severe Scrub Typhus with Multi-organ Dysfunction"}
    ],
    "red_flags": ["altered consciousness", "ARDS", "renal failure", "jaundice with fever + eschar"],
    "urgency_level": "Emergency (complicated) / Urgent (uncomplicated)",
    "forward_to": "108 for complicated; ESIC Hospital for uncomplicated with doxycycline initiation",
    "notes": "Doxycycline 100 mg BD is curative. Search carefully for eschar in skin folds. Notifiable in Assam. Endemic in NE India."
  },
  {
    "group_id": "TRAUMA_001",
    "group_name": "TRAUMA / INJURY",
    "condition_name": "Traumatic Head Injury",
    "trigger_keywords": ["head injury", "sar pe chot", "fall on head", "accident head", "unconscious after head hit", "helmet injury", "TBI"],
    "probing_questions": [
      "Was there loss of consciousness — for how long?",
      "Is the patient conscious now — can they tell you their name and where they are?",
      "Is there memory loss for events before or after the injury?",
      "Is there vomiting after the head injury?",
      "Is there bleeding from the ear or nose?",
      "Is one pupil larger than the other (unequal pupils)?",
      "Any seizures after the injury?",
      "What was the mechanism — fall, road accident, assault?",
      "Is the patient on blood thinners?"
    ],
    "chief_complaint_patterns": [
      "Road accident + loss of consciousness + vomiting + GCS deteriorating — severe TBI",
      "Fall from height + head injury + CSF from ear/nose — base of skull fracture",
      "Patient struck head + brief LOC, now alert but confused and headache — moderate TBI"
    ],
    "condition_mapping": [
      {"pattern": "head injury + GCS <13 + LOC + focal neurology", "suspected": "Severe Traumatic Brain Injury"},
      {"pattern": "head injury + clear fluid from ear/nose + battle's sign", "suspected": "Basal Skull Fracture"},
      {"pattern": "head injury + lucid interval then deterioration + fixed dilated pupil", "suspected": "Extradural Haematoma — Neurosurgical Emergency"}
    ],
    "red_flags": ["GCS <15", "LOC >5 min", "vomiting ≥2 times", "seizure post-injury", "CSF from ear/nose", "unequal pupils", "anticoagulant use"],
    "urgency_level": "Emergency",
    "forward_to": "108 Ambulance / ESIC Hospital with CT Scan and Neurosurgery",
    "notes": "Immobilise cervical spine. Do not give food/fluids. Call 108. NICE head injury criteria for CT. Time-critical for neurosurgery."
  },
  {
    "group_id": "TRAUMA_002",
    "group_name": "TRAUMA / INJURY",
    "condition_name": "Spinal Injury",
    "trigger_keywords": ["neck injury accident", "back injury can't move", "paralysis after fall", "gardan mein chot", "spinal cord injury", "can't feel legs after accident"],
    "probing_questions": [
      "Was there trauma to the neck or back?",
      "Is there tingling or numbness in the arms or legs?",
      "Can the patient move their legs normally?",
      "Any loss of bladder or bowel control?",
      "Is there tenderness along the spine?",
      "Was there axial loading (diving, fall on head)?",
      "Is the patient conscious and cooperative?",
      "What was the mechanism of injury?"
    ],
    "chief_complaint_patterns": [
      "Diving accident + neck pain + inability to move arms and legs — cervical cord injury",
      "Fall from height + loss of bladder control + lower limb weakness",
      "Road accident + back pain + paraplegia"
    ],
    "condition_mapping": [
      {"pattern": "trauma + weakness/sensory loss below level + bowel/bladder dysfunction", "suspected": "Spinal Cord Injury"},
      {"pattern": "neck trauma + quadriplegia + respiratory difficulty", "suspected": "High Cervical Cord Injury — ventilation risk"},
      {"pattern": "back pain post-trauma + no neurology", "suspected": "Vertebral Fracture without cord injury"}
    ],
    "red_flags": ["paralysis", "bladder/bowel dysfunction", "high cervical injury with breathing difficulty", "priapism (spinal shock)"],
    "urgency_level": "Emergency",
    "forward_to": "108 Ambulance / ESIC Hospital with Neurosurgery / Spine Surgery",
    "notes": "DO NOT move without cervical spine immobilisation. Log roll if must be moved. Call 108. Methyl prednisolone controversial — follow local protocol."
  },
  {
    "group_id": "TRAUMA_003",
    "group_name": "TRAUMA / INJURY",
    "condition_name": "Severe Burns",
    "trigger_keywords": ["burn injury", "jal gaya", "scalded", "fire burn", "chemical burn", "acid burn", "electrical burn", "full thickness burn"],
    "probing_questions": [
      "What caused the burn — fire, steam, chemical, electrical?",
      "How much of the body surface is burned (use Rule of Nines)?",
      "Is the airway affected — is there hoarseness, singed nasal hair, or facial burns?",
      "Is the patient conscious and breathing?",
      "Is there charring (full-thickness burn)?",
      "How long ago did the burn happen?",
      "Is there an associated explosion or blast?",
      "Any inhalation injury — was the person in an enclosed space with smoke?"
    ],
    "chief_complaint_patterns": [
      "Electrical burn + cardiac arrest + entry and exit wound",
      "House fire burns to face + singed nasal hairs + hoarse voice — inhalation injury",
      "Flame burns >20% BSA + deep partial thickness + chemical burns"
    ],
    "condition_mapping": [
      {"pattern": "burns + facial burns + singed nasal hair + hoarse voice", "suspected": "Burns with Airway Involvement — Immediate intubation risk"},
      {"pattern": "burns >20% BSA + full thickness", "suspected": "Major Burns — Fluid resuscitation (Parkland formula)"},
      {"pattern": "electrical burn + dysrhythmia + entry/exit wounds", "suspected": "Electrical Injury — Cardiac monitoring essential"}
    ],
    "red_flags": ["airway burns", "burns >20% BSA", "electrical burns", "chemical burns to face/eyes", "inhalation injury signs"],
    "urgency_level": "Emergency",
    "forward_to": "108 Ambulance / ESIC Hospital / Burns Centre",
    "notes": "Airway is priority. Cool burn with running water for 20 minutes. Do NOT apply oil, toothpaste, or ice. Call 108. Parkland formula for fluid: 4 × weight (kg) × %BSA burned = mL RL in 24h."
  },
  {
    "group_id": "TRAUMA_004",
    "group_name": "TRAUMA / INJURY",
    "condition_name": "Polytrauma / Major Trauma",
    "trigger_keywords": ["road accident multiple injuries", "multi-trauma", "accident bahut chot", "RTA with multiple injury", "crush injury road", "fall multiple injuries"],
    "probing_questions": [
      "What was the mechanism — road accident, fall from height, crush?",
      "Is the patient conscious and breathing?",
      "Is there active external bleeding?",
      "Any deformity of limbs suggesting fractures?",
      "Is the patient's heart rate rapid and BP low (shock)?",
      "Is there abdominal tenderness (internal haemorrhage)?",
      "Any chest injury — paradoxical breathing?",
      "Is the patient on blood thinners?"
    ],
    "chief_complaint_patterns": [
      "RTA victim — unconscious, multiple limb fractures, abdominal bruising — polytrauma",
      "Fall from height — chest injury + abdominal injury + head injury",
      "Crush injury — trapped worker with multiple injuries"
    ],
    "condition_mapping": [
      {"pattern": "haemodynamic shock + multi-system injury + trauma mechanism", "suspected": "Major Trauma / Haemorrhagic Shock"},
      {"pattern": "polytrauma + abdominal tenderness + shock", "suspected": "Intra-abdominal Haemorrhage"},
      {"pattern": "polytrauma + respiratory distress + chest injury", "suspected": "Traumatic Haemopneumothorax"}
    ],
    "red_flags": ["haemodynamic shock", "altered consciousness", "respiratory distress", "active major bleeding", "mechanism indicating high energy"],
    "urgency_level": "Emergency",
    "forward_to": "108 Ambulance / ESIC Hospital Trauma Centre",
    "notes": "ABCDE approach: Airway, Breathing, Circulation, Disability, Exposure. Control haemorrhage. Call 108 immediately. Do not move without precautions if spinal injury possible."
  },
  {
    "group_id": "TOX_001",
    "group_name": "TOXICOLOGY / POISONING",
    "condition_name": "Organophosphate (OP) Poisoning",
    "trigger_keywords": ["pesticide poisoning", "keetnashak", "keedamar zahr", "agricultural chemical swallowed", "salivation sweating fits poison", "OP poisoning", "insecticide ingested"],
    "probing_questions": [
      "Did the person swallow, inhale, or have skin contact with a pesticide or insecticide?",
      "Which pesticide — name, brand?",
      "Is there excessive salivation, sweating, and lacrimation?",
      "Are the pupils pinpoint?",
      "Is there vomiting, diarrhoea, and muscle twitching?",
      "Is there difficulty breathing or bronchospasm?",
      "Is the person conscious or having seizures?",
      "How long ago did the exposure happen?",
      "Was this a suicide attempt or accidental?"
    ],
    "chief_complaint_patterns": [
      "Farmer found with empty pesticide bottle + pinpoint pupils + excessive secretions + seizures — OP poisoning",
      "SLUDGE syndrome: Salivation, Lacrimation, Urination, Defaecation, GI distress, Emesis — OP toxidrome",
      "Agro-chemical ingestion + miosis + bradycardia + bronchospasm"
    ],
    "condition_mapping": [
      {"pattern": "pesticide exposure + SLUDGE syndrome + miosis + bradycardia", "suspected": "Organophosphate / Carbamate Poisoning"},
      {"pattern": "OP poisoning + seizures + respiratory failure", "suspected": "Severe OP Poisoning — ICU"},
      {"pattern": "OP poisoning intermediate syndrome", "suspected": "OP Intermediate Syndrome — respiratory paralysis 24-96h after recovery"}
    ],
    "red_flags": ["seizures", "respiratory failure", "miosis + bradycardia + copious secretions", "unconscious"],
    "urgency_level": "Emergency",
    "forward_to": "108 Ambulance / ESIC Hospital with ICU and Poison Treatment Facility",
    "notes": "Atropine is antidote (large doses required). Pralidoxime (PAM) if available within 24h. Remove clothing, wash skin. Call 108. Notifiable intentional poisoning. ESIC covers occupational exposure."
  },
  {
    "group_id": "TOX_002",
    "group_name": "TOXICOLOGY / POISONING",
    "condition_name": "Snakebite",
    "trigger_keywords": ["saanp ka kaata", "snake bite", "snake attack", "bitten by snake", "sanp ne kata", "swelling after snake", "fang marks"],
    "probing_questions": [
      "When did the snakebite occur?",
      "Can the patient describe the snake — colour, size, hood?",
      "Is there swelling progressing up the limb?",
      "Is there bleeding from the bite site, gums, or in urine?",
      "Is there drooping of eyelids, double vision, or difficulty swallowing (neurotoxicity)?",
      "Is the patient breathing normally?",
      "Is there pain and local tissue destruction at the bite site?",
      "Has there been any first aid applied?"
    ],
    "chief_complaint_patterns": [
      "Russell's viper bite + coagulopathy + bleeding from bite + gum bleeding",
      "Cobra/krait bite + ptosis + difficulty breathing + descending paralysis — neurotoxic",
      "Snakebite + rapidly progressive swelling + local tissue necrosis — cytotoxic"
    ],
    "condition_mapping": [
      {"pattern": "snakebite + bleeding + coagulopathy (20WBCT positive)", "suspected": "Haemotoxic Snakebite — Viper Envenomation"},
      {"pattern": "snakebite + ptosis + difficulty swallowing + respiratory paralysis", "suspected": "Neurotoxic Snakebite — Cobra/Krait Envenomation"},
      {"pattern": "snakebite + massive local swelling + necrosis + no systemic features", "suspected": "Cytotoxic Snakebite"}
    ],
    "red_flags": ["respiratory paralysis", "coagulopathy with bleeding", "rapidly spreading swelling", "consciousness alteration", "ptosis progressing"],
    "urgency_level": "Emergency",
    "forward_to": "108 Ambulance / ESIC Hospital / Government Hospital with Polyvalent Anti-Snake Venom (ASV)",
    "notes": "Immobilise bitten limb below heart level. Do NOT incise, suck, or apply tourniquet. Polyvalent ASV is the antidote. ASV available at government hospitals. Call 108. 20 WBCT for coagulopathy assessment."
  },
  {
    "group_id": "TOX_003",
    "group_name": "TOXICOLOGY / POISONING",
    "condition_name": "Acid / Alkali Ingestion",
    "trigger_keywords": ["acid swallowed", "phenyl drink", "corrosive ingested", "tezab piya", "toilet cleaner swallowed", "chemical swallowed", "alkali ingested mouth burn"],
    "probing_questions": [
      "What substance was ingested — acid (tezab) or alkali (phenyl, toilet cleaner)?",
      "How much was ingested?",
      "Is there burning pain in the mouth, throat, and chest?",
      "Is there drooling or inability to swallow?",
      "Is there hoarseness of voice?",
      "Is there difficulty breathing?",
      "Any vomiting — is there blood in the vomit?",
      "Was this a suicide attempt?"
    ],
    "chief_complaint_patterns": [
      "Child ingested toilet cleaner (alkali) + burns to lips and mouth + drooling",
      "Adult ingested acid (suicide attempt) + severe oropharyngeal burns + haematemesis",
      "Corrosive ingestion + hoarse voice + stridor — airway emergency"
    ],
    "condition_mapping": [
      {"pattern": "corrosive ingestion + oropharyngeal burns + drooling + stridor", "suspected": "Corrosive Oropharyngeal/Oesophageal Burns — Airway Emergency"},
      {"pattern": "alkali ingestion + oesophageal injury + no gastric injury", "suspected": "Alkali Ingestion (liquefactive necrosis — oesophagus)"},
      {"pattern": "acid ingestion + gastric injury + oesophagus relatively spared", "suspected": "Acid Ingestion (coagulative necrosis — stomach)"}
    ],
    "red_flags": ["stridor", "drooling", "voice change (hoarseness)", "haematemesis", "respiratory distress"],
    "urgency_level": "Emergency",
    "forward_to": "108 Ambulance / ESIC Hospital with ENT and GI Surgery",
    "notes": "Do NOT induce vomiting — worsens injury. Do NOT give neutralising agents. Give nothing by mouth. Airway is priority. Endoscopy within 12-24h for staging. Call 108."
  },
  {
    "group_id": "TOX_004",
    "group_name": "TOXICOLOGY / POISONING",
    "condition_name": "Alcohol Poisoning / Hooch Tragedy",
    "trigger_keywords": ["drunk unconscious", "country liquor poisoning", "desi daru poison", "methanol poisoning", "spurious liquor", "hooch tragedy", "sharab se behoshi"],
    "probing_questions": [
      "How much alcohol was consumed and what type (country liquor, commercial, or homemade)?",
      "Is the person conscious and responsive?",
      "Is there any visual disturbance or blindness (methanol)?",
      "How long ago did they consume?",
      "Is there vomiting?",
      "Any seizures?",
      "Is there severe metabolic acidosis?",
      "Are multiple people from the same gathering affected (hooch/mass poisoning)?"
    ],
    "chief_complaint_patterns": [
      "Multiple people unconscious after drinking country liquor from same batch — methanol poisoning/hooch",
      "Drunk patient with vision loss and blindness — methanol toxicity",
      "Unconscious patient after excessive alcohol with aspiration vomiting"
    ],
    "condition_mapping": [
      {"pattern": "country liquor ingestion + vision loss + multiple casualties", "suspected": "Methanol Poisoning / Hooch Tragedy — Mass Casualty"},
      {"pattern": "alcohol ingestion + unconscious + aspiration", "suspected": "Acute Alcohol Intoxication with Aspiration Risk"},
      {"pattern": "alcohol ingestion + seizures", "suspected": "Alcohol Withdrawal Seizures (chronic alcoholic)"}
    ],
    "red_flags": ["visual disturbance or blindness", "multiple casualties from same source", "unconscious", "seizures", "severe metabolic acidosis"],
    "urgency_level": "Emergency",
    "forward_to": "108 Ambulance / ESIC Hospital / Government Hospital",
    "notes": "Methanol poisoning: fomepizole or ethanol is antidote. Haemodialysis may be needed. Multiple casualties = mass casualty protocol. Report to authorities. Position unconscious patient in recovery position."
  },
  {
    "group_id": "TOX_005",
    "group_name": "TOXICOLOGY / POISONING",
    "condition_name": "Paracetamol / Drug Overdose",
    "trigger_keywords": ["paracetamol overdose", "tablet overdose suicide", "sleeping pills overdose", "drug overdose", "dawa jyada kha li", "suicide pills"],
    "probing_questions": [
      "What tablets/medications were taken and how many?",
      "When were they taken?",
      "Was this a deliberate overdose (suicide attempt)?",
      "Is the patient conscious?",
      "Any vomiting?",
      "Any history of liver disease (increases paracetamol risk)?",
      "Any other substances (alcohol) taken at the same time?",
      "Any other medical conditions?"
    ],
    "chief_complaint_patterns": [
      "Adult took 20 paracetamol tablets 2 hours ago — activated charcoal and NAC urgently",
      "Unconscious patient after multiple different tablet ingestion — mixed overdose",
      "Suicide attempt with sleeping pills (benzodiazepines) + alcohol"
    ],
    "condition_mapping": [
      {"pattern": "paracetamol overdose within 8h + staggered doses + liver disease", "suspected": "Paracetamol Toxicity — N-acetylcysteine (NAC) urgently"},
      {"pattern": "opioid overdose + pinpoint pupils + respiratory depression + unconscious", "suspected": "Opioid Toxidrome — Naloxone reversal"},
      {"pattern": "unconscious + mixed tablets + alcohol", "suspected": "Mixed Drug Overdose — Airway risk primary concern"}
    ],
    "red_flags": ["unconscious", "respiratory depression", "mixed overdose", "paracetamol >150 mg/kg", "known liver disease"],
    "urgency_level": "Emergency",
    "forward_to": "108 Ambulance / ESIC Hospital Casualty with Poison Treatment Unit",
    "notes": "Paracetamol antidote: N-acetylcysteine (NAC). Most effective within 8 hours. Opioid antidote: Naloxone. Always assess suicide risk and involve psychiatry. Activated charcoal if <1h and airway protected."
  },
  {
    "group_id": "DERM_001",
    "group_name": "DERMATOLOGICAL EMERGENCIES",
    "condition_name": "Stevens-Johnson Syndrome / TEN",
    "trigger_keywords": ["drug rash skin peeling", "medication rash blisters", "dawa se khaal utar rahi", "eyes red skin blisters drug", "SJS", "TEN", "severe drug rash"],
    "probing_questions": [
      "Is there a widespread skin rash with blisters or skin that is peeling off?",
      "Are the eyes red, swollen, or discharging?",
      "Are there painful sores in the mouth and genitals?",
      "Was a new medication started in the past 1–8 weeks (especially antibiotics, antiepileptics, allopurinol)?",
      "What percentage of skin appears affected?",
      "Is there fever?",
      "Is the patient in pain with even gentle touch to skin?",
      "Is there difficulty swallowing due to mouth involvement?"
    ],
    "chief_complaint_patterns": [
      "Drug started 2 weeks ago → fever + painful blistering rash + mucous membrane involvement + skin detachment",
      "Patient on carbamazepine with widespread painful erythema + skin peeling + eye involvement — TEN",
      "Rapidly spreading blistering + >30% skin involved + drug history — TEN"
    ],
    "condition_mapping": [
      {"pattern": "blistering rash + mucous membrane involvement + drug history + <10% BSA", "suspected": "Stevens-Johnson Syndrome (SJS)"},
      {"pattern": "blistering + skin detachment + >30% BSA + drug history", "suspected": "Toxic Epidermal Necrolysis (TEN) — Life-threatening"},
      {"pattern": "10-30% BSA involvement + blistering + drug", "suspected": "SJS-TEN Overlap"}
    ],
    "red_flags": ["skin detachment", "eye involvement", "mucosal ulceration", ">30% BSA", "rapidly spreading"],
    "urgency_level": "Emergency",
    "forward_to": "108 Ambulance / ESIC Hospital with Dermatology and Burns ICU",
    "notes": "STOP the causative drug immediately. TEN requires ICU/Burns unit care. High mortality (30-40% for TEN). Ophthalmology involvement essential for eye protection."
  },
  {
    "group_id": "DERM_002",
    "group_name": "DERMATOLOGICAL EMERGENCIES",
    "condition_name": "Necrotising Fasciitis",
    "trigger_keywords": ["flesh eating infection", "rapidly spreading skin infection", "wound turned black", "gas in tissue", "diabetic wound worsening", "crepitus wound"],
    "probing_questions": [
      "Is there a wound or skin infection that is spreading very rapidly?",
      "Is the skin turning black or dusky?",
      "Is there a crackling sensation on touching the skin (crepitus — gas in tissue)?",
      "Is there pain out of proportion to the appearance of the wound?",
      "Is there fever and signs of shock?",
      "Does the patient have diabetes, immunosuppression, or recent surgery?",
      "Is there a foul odour from the wound?",
      "Is the patient deteriorating rapidly despite antibiotics?"
    ],
    "chief_complaint_patterns": [
      "Diabetic patient with rapidly spreading leg cellulitis + crepitus + skin necrosis + septic shock",
      "Post-surgical wound with rapidly spreading inflammation + tissue necrosis + foul smell",
      "Pain disproportionate to wound appearance + fever + skin colour change to dark"
    ],
    "condition_mapping": [
      {"pattern": "rapidly spreading infection + skin necrosis + crepitus + septic shock", "suspected": "Necrotising Fasciitis — Surgical Emergency"},
      {"pattern": "perineal necrotising fasciitis + diabetic", "suspected": "Fournier's Gangrene — Emergency"},
      {"pattern": "gas gangrene: crepitus + dark wound + extremely ill", "suspected": "Clostridial Gas Gangrene"}
    ],
    "red_flags": ["crepitus", "skin necrosis", "rapidly spreading", "septic shock", "disproportionate pain"],
    "urgency_level": "Emergency",
    "forward_to": "108 Ambulance / ESIC Hospital with Surgery and ICU",
    "notes": "Mortality >30% without immediate surgical debridement. Do NOT delay surgery for IV antibiotics alone. Emergency theatre required."
  },
  {
    "group_id": "ENT_001",
    "group_name": "ENT EMERGENCIES",
    "condition_name": "Epistaxis (Severe Nosebleed)",
    "trigger_keywords": ["nose bleeding", "naak se khoon", "heavy nosebleed", "nosebleed won't stop", "epistaxis", "blood from nose"],
    "probing_questions": [
      "How long has the bleeding been going on?",
      "Is it coming from one nostril or both?",
      "How much blood — is it dripping or pouring?",
      "Is blood going down the throat?",
      "Is the patient on blood thinners (aspirin, warfarin, clopidogrel)?",
      "Is there a known history of hypertension?",
      "Is the patient feeling faint or dizzy?",
      "Any history of blood disorder or liver disease?",
      "Any recent trauma to the nose?"
    ],
    "chief_complaint_patterns": [
      "Hypertensive patient with heavy persistent epistaxis not stopped by pinching for 20 minutes",
      "Anticoagulated patient with nasal bleed + haemodynamic compromise",
      "Posterior epistaxis with blood flowing down throat and unable to be controlled"
    ],
    "condition_mapping": [
      {"pattern": "epistaxis > 20 minutes + anticoagulated + not controlled by first aid", "suspected": "Severe Anterior/Posterior Epistaxis — ENT Emergency"},
      {"pattern": "epistaxis + hypertension + not stopping", "suspected": "Hypertensive Epistaxis"},
      {"pattern": "epistaxis + bleeding disorder + haematoma", "suspected": "Coagulopathic Epistaxis"}
    ],
    "red_flags": ["haemodynamic compromise", "not stopping after 20 minutes", "anticoagulated", "swallowing large amounts of blood", "posterior epistaxis"],
    "urgency_level": "Urgent",
    "forward_to": "ESIC Hospital ENT / 108 if haemodynamically compromised",
    "notes": "First aid: lean forward, pinch soft part of nose for 10-20 minutes. Do NOT tip head back (swallowing blood causes vomiting). Cautery or posterior packing may be needed by ENT."
  },
  {
    "group_id": "ENT_002",
    "group_name": "ENT EMERGENCIES",
    "condition_name": "Foreign Body Airway Obstruction",
    "trigger_keywords": ["choking", "food stuck throat", "can't breathe foreign body", "child swallowed something", "dana atka", "kuch atka gala mein", "choking child"],
    "probing_questions": [
      "Is the person able to breathe, speak, or cough?",
      "Is there a high-pitched crowing sound when breathing (stridor)?",
      "Is the person turning blue (cyanosis)?",
      "What did they choke on — food, a small object?",
      "How old is the patient?",
      "Did it happen suddenly while eating or playing?",
      "Is the person able to forcefully cough?"
    ],
    "chief_complaint_patterns": [
      "Child suddenly stopped crying + turned blue + cannot breathe — complete airway obstruction",
      "Adult choking on food + cannot speak + clutching throat — complete obstruction",
      "Partial obstruction: stridor + able to cough and make sounds"
    ],
    "condition_mapping": [
      {"pattern": "complete obstruction: cannot breathe/speak + cyanosis", "suspected": "Complete Foreign Body Airway Obstruction — Immediate Heimlich/Back Blows"},
      {"pattern": "partial obstruction: able to cough + stridor", "suspected": "Partial FBAO — Encourage coughing, monitor closely"},
      {"pattern": "child with stridorous breathing + history of putting objects in mouth", "suspected": "Inhaled Foreign Body in Child"}
    ],
    "red_flags": ["complete obstruction", "cyanosis", "inability to breathe or make sounds", "child turning blue"],
    "urgency_level": "Emergency",
    "forward_to": "108 Ambulance / ESIC Hospital ENT",
    "notes": "Complete FBAO: Heimlich manoeuvre (abdominal thrusts) for adults/older children; Back blows + chest thrusts for infants. If unconscious: start CPR. Call 108."
  },
  {
    "group_id": "ENT_003",
    "group_name": "ENT EMERGENCIES",
    "condition_name": "Ludwig's Angina",
    "trigger_keywords": ["jaw swelling mouth can't open", "floor of mouth swelling", "tooth infection neck swelling", "dental abscess spreading", "jaw neck swelling breathing difficult", "dant ke baad gardan sujan"],
    "probing_questions": [
      "Is there severe swelling of the jaw, floor of mouth, or neck?",
      "Is the tongue pushed upward?",
      "Is there difficulty opening the mouth (trismus)?",
      "Is there difficulty breathing or swallowing?",
      "Is the voice changed or muffled?",
      "Was there a recent dental abscess or tooth infection?",
      "Is there high fever and toxicity?",
      "Is the patient drooling?"
    ],
    "chief_complaint_patterns": [
      "Recent tooth extraction + rapidly spreading floor of mouth swelling + stridor + cannot open mouth",
      "Dental abscess + bilateral neck swelling + unable to swallow + airway compromise",
      "Ludwig's angina with impending airway obstruction"
    ],
    "condition_mapping": [
      {"pattern": "dental infection + floor of mouth swelling + trismus + stridor", "suspected": "Ludwig's Angina — Airway Emergency"},
      {"pattern": "spreading neck infection + mediastinal involvement", "suspected": "Descending Necrotising Mediastinitis"},
      {"pattern": "neck space infection + septic shock", "suspected": "Deep Neck Space Infection with Sepsis"}
    ],
    "red_flags": ["stridor", "drooling", "tongue pushed up", "cannot open mouth", "respiratory distress"],
    "urgency_level": "Emergency",
    "forward_to": "108 Ambulance / ESIC Hospital with ENT, Maxillofacial Surgery, and ICU",
    "notes": "Airway management is priority — may require awake fibreoptic intubation or surgical airway. IV antibiotics urgently. Call 108."
  },
  {
    "group_id": "OPHTHAL_001",
    "group_name": "OPHTHALMOLOGICAL EMERGENCIES",
    "condition_name": "Acute Angle Closure Glaucoma",
    "trigger_keywords": ["sudden eye pain", "halos around lights", "painful red eye sudden vision loss", "glaucoma attack", "aankh mein tej dard", "sudden vision loss headache eye"],
    "probing_questions": [
      "Is there sudden severe pain in one eye?",
      "Is the vision blurred in that eye?",
      "Are there coloured halos around lights?",
      "Is the eye red?",
      "Is there nausea or vomiting with the eye pain?",
      "Is the patient middle-aged or elderly?",
      "Is the cornea hazy-looking?",
      "Is there a fixed mid-dilated pupil?"
    ],
    "chief_complaint_patterns": [
      "Sudden severe unilateral eye pain + blurred vision + coloured halos + headache + vomiting — acute angle closure",
      "Red painful eye + fixed mid-dilated pupil + raised IOP + corneal haziness",
      "Elderly patient with headache, vomiting, and painful red eye — GI symptoms may mislead"
    ],
    "condition_mapping": [
      {"pattern": "sudden eye pain + halos + blurred vision + red eye + vomiting", "suspected": "Acute Angle Closure Glaucoma"},
      {"pattern": "acute red eye + photophobia + no vision change", "suspected": "Anterior Uveitis / Iritis (differential)"},
      {"pattern": "sudden painless vision loss", "suspected": "Central Retinal Artery Occlusion (differential)"}
    ],
    "red_flags": ["sudden vision loss", "fixed pupil", "corneal haziness", "IOP >40 mmHg", "vomiting with eye pain"],
    "urgency_level": "Emergency",
    "forward_to": "108 Ambulance / ESIC Hospital with Ophthalmology",
    "notes": "IOP >40 mmHg causes irreversible damage in hours. Pilocarpine drops + IV acetazolamide urgently. Laser iridotomy is definitive treatment. Call 108 for ophthalmic emergency."
  },
  {
    "group_id": "OPHTHAL_002",
    "group_name": "OPHTHALMOLOGICAL EMERGENCIES",
    "condition_name": "Chemical Eye Injury",
    "trigger_keywords": ["chemical in eye", "acid in eye", "alkali eye", "tezab aankh mein", "eye burn chemical", "bleach in eye", "eye washing urgently"],
    "probing_questions": [
      "What chemical got into the eye — acid or alkali?",
      "When did it happen?",
      "Has the eye been washed with water immediately?",
      "Is there severe pain, redness, and tearing?",
      "Is there any visible damage to the cornea?",
      "Is the person able to see?",
      "Any corneal whitening or hazing?"
    ],
    "chief_complaint_patterns": [
      "Lime/cement in eye + severe pain + corneal whitening — alkali burns (lime is alkali)",
      "Battery acid splash in eye + immediate severe pain and redness",
      "Industrial chemical exposure to eye + partial vision loss"
    ],
    "condition_mapping": [
      {"pattern": "alkali in eye (cement, lime, oven cleaner)", "suspected": "Alkali Chemical Eye Injury — Higher risk, penetrating damage"},
      {"pattern": "acid in eye", "suspected": "Acid Chemical Eye Injury — Coagulative, usually more superficial"},
      {"pattern": "chemical eye + corneal ulceration + visual loss", "suspected": "Chemical Eye Injury with Corneal Damage — Urgent Ophthalmology"}
    ],
    "red_flags": ["corneal whitening/hazing", "visual loss", "alkali exposure (worse prognosis)", "delayed irrigation"],
    "urgency_level": "Emergency",
    "forward_to": "108 Ambulance / ESIC Hospital Ophthalmology",
    "notes": "IMMEDIATE and PROLONGED irrigation (30 minutes) with clean water or saline is the single most important first-aid step. Start irrigation BEFORE transport. Alkali burns are worse — penetrate deeper."
  },
  {
    "group_id": "PSYCH_001",
    "group_name": "PSYCHIATRIC EMERGENCIES",
    "condition_name": "Acute Psychosis",
    "trigger_keywords": ["mental crisis", "pagal ho gaya", "seeing things", "hearing voices", "threatening behaviour", "paranoid attack", "schizophrenia crisis", "psychiatric emergency"],
    "probing_questions": [
      "Is the patient behaving dangerously — to themselves or others?",
      "Is the patient hearing voices or seeing things that others cannot?",
      "Is the patient on psychiatric medication — have they missed doses?",
      "Is there a history of schizophrenia or bipolar disorder?",
      "Is there any drug or alcohol use that may have triggered this?",
      "Is the patient calm enough to be approached safely?",
      "Is there a risk of violence or self-harm?",
      "Any recent head injury, fever, or medical illness that could cause this?"
    ],
    "chief_complaint_patterns": [
      "Known schizophrenic off medication + aggressive + hearing voices + not sleeping for days",
      "First episode psychosis — young adult with bizarre behaviour, paranoid delusions, and self-neglect",
      "Mania with grandiosity + agitation + not sleeping + risky behaviour"
    ],
    "condition_mapping": [
      {"pattern": "known schizophrenia + off meds + aggressive + hallucinations", "suspected": "Acute Psychotic Episode / Relapse"},
      {"pattern": "first episode psychosis + young adult + no prior history", "suspected": "First Episode Psychosis — needs full medical workup to exclude organic cause"},
      {"pattern": "elevated mood + no sleep + grandiosity + risky behaviour + psychosis", "suspected": "Bipolar I — Acute Mania with Psychosis"}
    ],
    "red_flags": ["immediate danger to self or others", "medical cause not excluded", "unable to care for self", "command hallucinations (being told to harm)"],
    "urgency_level": "Emergency",
    "forward_to": "108 Ambulance / ESIC Hospital Psychiatry / Government Mental Health Unit",
    "notes": "Safety first — for staff and patient. Involve police if danger to others. De-escalate verbally if safe. Medical causes (encephalitis, metabolic) must be excluded in first episode. Refer to 104 for follow-up."
  },
  {
    "group_id": "PSYCH_002",
    "group_name": "PSYCHIATRIC EMERGENCIES",
    "condition_name": "Suicidal Ideation / Suicide Attempt",
    "trigger_keywords": ["wants to die", "suicide attempt", "mar jaana chahta hai", "self-harm", "swallowed tablets", "khud ko chot", "suicidal", "poison self"],
    "probing_questions": [
      "Has the person expressed a wish to die or hurt themselves?",
      "Has there been any actual attempt — tablets taken, wrist cut, etc.?",
      "Is there a specific plan and means available?",
      "Is there a history of previous suicide attempts?",
      "Are there any current mental health conditions — depression, PTSD?",
      "Is there substance use?",
      "Is the patient alone or is there someone with them?",
      "Are there any medical concerns from the attempt (overdose, bleeding)?"
    ],
    "chief_complaint_patterns": [
      "Wrist laceration after stated intent to die — suicide attempt — medical and psychiatric emergency",
      "Overdose of tablets following relationship breakdown — assessed for lethality of ingestion",
      "Person expressing active suicidal ideation with a plan and access to means"
    ],
    "condition_mapping": [
      {"pattern": "overdose of tablets + stated intent to die", "suspected": "Suicide Attempt — Medical Emergency + Psychiatric Emergency"},
      {"pattern": "suicidal ideation + plan + means + hopelessness", "suspected": "High-Risk Suicidal Ideation — Emergency Psychiatric Assessment"},
      {"pattern": "self-harm without suicidal intent (cutting, burning)", "suspected": "Non-suicidal Self-Injury — Urgent psychiatric review"}
    ],
    "red_flags": ["concrete plan + means available", "previous serious attempt", "male + elderly + isolated", "current medical lethality (overdose, blood loss)"],
    "urgency_level": "Emergency",
    "forward_to": "108 Ambulance / ESIC Hospital Casualty + Psychiatry / 104 Health Helpline for counselling",
    "notes": "Do NOT leave the person alone. Do not argue about suicidal feelings. Remove access to means if safe. 104 Health Helpline has counsellors. SNEHA / iCall can also be referred. Always take threats seriously."
  },
  {
    "group_id": "PSYCH_003",
    "group_name": "PSYCHIATRIC EMERGENCIES",
    "condition_name": "Serotonin Syndrome",
    "trigger_keywords": ["antidepressant overdose reaction", "SSRI bad reaction", "shivering agitated after antidepressant", "serotonin toxicity", "tremor agitation antidepressant", "drug reaction antidepressant"],
    "probing_questions": [
      "Has the patient recently started, increased dose, or combined serotonergic medications?",
      "Is there agitation or restlessness?",
      "Is there tremor or muscle rigidity?",
      "Is there a rapid heart rate and high body temperature?",
      "Is there diarrhoea?",
      "Are there clonus or exaggerated reflexes?",
      "Is the patient confused?",
      "What medications are they on — SSRIs, MAOIs, tramadol, lithium, triptans?"
    ],
    "chief_complaint_patterns": [
      "Patient started tramadol while on SSRI + agitation + tremor + hyperthermia + clonus",
      "SSRI + MAOI combination + severe hyperthermia + rigidity + altered consciousness",
      "After dose increase of antidepressant + agitated + diarrhoea + sweating + tremor"
    ],
    "condition_mapping": [
      {"pattern": "serotonergic drug + agitation + tremor + clonus + hyperthermia", "suspected": "Serotonin Syndrome — Hunter Criteria"},
      {"pattern": "severe serotonin syndrome + hyperthermia >41°C + rigidity + coma", "suspected": "Life-threatening Serotonin Syndrome"},
      {"pattern": "antipsychotic + high temperature + rigidity + bradykinesia", "suspected": "Neuroleptic Malignant Syndrome (differential)"}
    ],
    "red_flags": ["hyperthermia >38.5°C", "clonus", "rigidity", "altered consciousness", "combination of serotonergic drugs"],
    "urgency_level": "Emergency",
    "forward_to": "108 Ambulance / ESIC Hospital with ICU",
    "notes": "Stop all serotonergic agents. Cyproheptadine if available. Cooling for hyperthermia. Benzodiazepines for agitation. ICU if severe. Call 108."
  },
  {
    "group_id": "MSK_001",
    "group_name": "MUSCULOSKELETAL CONDITIONS",
    "condition_name": "Compartment Syndrome",
    "trigger_keywords": ["limb tightness after fracture", "cast too tight", "limb pain not controlled", "5 Ps fracture", "haath pair mein zyada dard plaster ke baad", "cast pain worsening"],
    "probing_questions": [
      "Is there increasing pain in the limb despite analgesia after an injury?",
      "Is there a tight feeling or swelling in the limb?",
      "Is there tingling or numbness distal to the injury?",
      "Is there a cast or splint on — is it too tight?",
      "Can the patient move the fingers or toes?",
      "Is the limb pale, cool, or pulseless distally?",
      "Was there a crushing or high-energy injury?",
      "How long ago was the injury or surgery?"
    ],
    "chief_complaint_patterns": [
      "Post-fracture with cast: worsening pain not controlled by analgesia + tight forearm",
      "Crush injury to lower leg + uncontrolled pain + tense swelling + neurological deficit",
      "Post-tibial fracture + pain on passive stretch + loss of sensation between toes"
    ],
    "condition_mapping": [
      {"pattern": "fracture/crush + pain disproportionate + tense compartment + 6 Ps", "suspected": "Acute Compartment Syndrome — Fasciotomy needed"},
      {"pattern": "compartment syndrome >6 hours without treatment", "suspected": "Established Compartment Syndrome — Rhabdomyolysis + AKI risk"},
      {"pattern": "post-burn limb swelling + pain + loss of pulses", "suspected": "Burns-related Compartment Syndrome"}
    ],
    "red_flags": ["pain out of proportion", "pain on passive stretch", "tense swelling", "loss of sensation/pulses", "tight cast"],
    "urgency_level": "Emergency",
    "forward_to": "108 Ambulance / ESIC Hospital with Orthopaedic Surgery",
    "notes": "Fasciotomy within 6 hours prevents muscle necrosis. If cast — split/bivalve cast immediately. Call 108. Time-critical."
  },
  {
    "group_id": "MSK_002",
    "group_name": "MUSCULOSKELETAL CONDITIONS",
    "condition_name": "Rhabdomyolysis",
    "trigger_keywords": ["dark tea coloured urine after exertion", "cola coloured urine", "muscle pain weakness", "crush injury muscle pain", "myoglobinuria", "peshab lal hona muscle injury"],
    "probing_questions": [
      "Is the urine dark — red, brown, or tea-coloured?",
      "Is there severe muscle pain, swelling, or weakness?",
      "Was there a crush injury, prolonged immobilisation, or extreme exertion?",
      "Any recent use of statins, alcohol, or drugs?",
      "Is there any decreased urine output?",
      "Any heat exposure or extreme exercise?",
      "Any seizures or prolonged lying on hard floor?"
    ],
    "chief_complaint_patterns": [
      "Construction worker after being trapped under rubble + dark urine + muscle pain + oliguria",
      "Extreme marathon runner with severe myalgia + dark urine + AKI",
      "Patient on statin + intercurrent illness + severe myalgia + dark urine"
    ],
    "condition_mapping": [
      {"pattern": "crush injury + dark urine + severe myalgia + elevated CK", "suspected": "Rhabdomyolysis with Myoglobinuria"},
      {"pattern": "rhabdomyolysis + oliguria + rising creatinine", "suspected": "Rhabdomyolysis causing AKI"},
      {"pattern": "statin + infection + myalgia + dark urine", "suspected": "Drug-induced Rhabdomyolysis"}
    ],
    "red_flags": ["dark urine", "decreasing urine output", "severe myalgia with muscle swelling", "crush mechanism"],
    "urgency_level": "Emergency",
    "forward_to": "108 Ambulance / ESIC Hospital with Nephrology",
    "notes": "Aggressive IV fluid resuscitation (targeted urine output 200-300 ml/hr) is key to prevent AKI. Monitor K+ for hyperkalaemia. CK >10,000 = high risk."
  },
  {
    "group_id": "MSK_003",
    "group_name": "MUSCULOSKELETAL CONDITIONS",
    "condition_name": "Fractures and Dislocations",
    "trigger_keywords": ["broken bone", "haddi toot gayi", "dislocation", "joint out of place", "deformed limb", "shoulder out", "knee injury can't walk"],
    "probing_questions": [
      "What was the mechanism of injury?",
      "Is the limb deformed or at an abnormal angle?",
      "Is there point tenderness over the bone?",
      "Can the patient move the limb at all?",
      "Is there open wound with bone visible (open/compound fracture)?",
      "Is distal circulation intact — are the fingers/toes warm with pulses?",
      "Is there neurological deficit below the injury?",
      "Any history of osteoporosis or cancer (pathological fracture risk)?"
    ],
    "chief_complaint_patterns": [
      "Road accident + deformed right femur + pain + haemodynamic compromise — femur fracture with blood loss",
      "Fall on outstretched hand + wrist deformity + point tenderness — Colles fracture",
      "Open fracture with bone visible + contamination + wound — compound fracture"
    ],
    "condition_mapping": [
      {"pattern": "femur fracture + shock + blood loss", "suspected": "Femoral Shaft Fracture — 1-2L blood loss risk"},
      {"pattern": "fracture + bone exposed + wound contamination", "suspected": "Open / Compound Fracture — Infection risk, surgical emergency"},
      {"pattern": "dislocation + distal neurovascular compromise", "suspected": "Dislocation with Neurovascular Injury — Emergency reduction"}
    ],
    "red_flags": ["open fracture", "neurovascular compromise", "femur fracture with shock", "spine injury risk with mechanism"],
    "urgency_level": "Emergency (open fracture, neurovascular compromise) / Urgent (closed fracture)",
    "forward_to": "108 Ambulance for emergencies / ESIC Hospital Orthopaedics",
    "notes": "Immobilise before transport. Open fractures: cover with clean dressing, IV antibiotics urgently. Femur fracture: IV access and fluids. Call 108."
  },
  {
    "group_id": "OCC_001",
    "group_name": "OCCUPATIONAL INJURIES (ESIC-RELEVANT)",
    "condition_name": "Electrical Injury at Workplace",
    "trigger_keywords": ["bijli ka jhatka", "electrical shock", "electric current", "industrial electrical injury", "workplace electric accident", "electrocution"],
    "probing_questions": [
      "What was the voltage — low (domestic) or high (industrial)?",
      "Is the person still in contact with the electrical source?",
      "Is the person conscious and breathing?",
      "Are there entry and exit burns?",
      "Any cardiac arrest or loss of consciousness?",
      "Is there muscle pain or dark urine (rhabdomyolysis)?",
      "Was the person thrown or fell from height after the shock?",
      "Any spinal or head injury from fall?"
    ],
    "chief_complaint_patterns": [
      "Industrial electrician — contact with high-voltage line + entry wound + exit wound + cardiac arrhythmia",
      "Domestic electrical shock + LOC + entry burn on hand + fall",
      "High-voltage electrical injury + severe burns + rhabdomyolysis + AKI"
    ],
    "condition_mapping": [
      {"pattern": "high-voltage electrical injury + cardiac arrest + entry/exit burns", "suspected": "High-Voltage Electrical Injury — Cardiac arrest, burns, rhabdomyolysis"},
      {"pattern": "low-voltage shock + LOC + normal-looking wound", "suspected": "Low-Voltage Electrical Injury — Internal injury, arrhythmia risk"},
      {"pattern": "electrical injury + dark urine + muscle pain", "suspected": "Electrical Injury with Rhabdomyolysis"}
    ],
    "red_flags": ["cardiac arrest", "loss of consciousness", "high-voltage exposure", "entry/exit wounds", "dark urine post-shock"],
    "urgency_level": "Emergency",
    "forward_to": "108 Ambulance / ESIC Hospital Casualty",
    "notes": "DO NOT touch the victim until power is OFF. CPR if no pulse. Cardiac monitoring for 24h after high-voltage injury. ESIC covers occupational injuries. Report as industrial accident."
  },
  {
    "group_id": "OCC_002",
    "group_name": "OCCUPATIONAL INJURIES (ESIC-RELEVANT)",
    "condition_name": "Heat Stroke at Workplace",
    "trigger_keywords": ["heat stroke factory", "garmi mein behosh", "hot workplace collapse", "high temperature collapse", "worker fainted heat", "heat exhaustion severe"],
    "probing_questions": [
      "Was the person working in a hot environment — factory, outdoor in summer?",
      "What is the body temperature?",
      "Is the person conscious and oriented?",
      "Is there absence of sweating in a very hot environment (classic heat stroke)?",
      "Is the skin hot, red, and dry?",
      "Any seizures?",
      "How long were they exposed to high heat?",
      "Is there any confusion, slurred speech, or incoordination?"
    ],
    "chief_complaint_patterns": [
      "Factory worker in summer collapsed + hot dry skin + no sweating + temperature 41°C + confused — classic heat stroke",
      "Construction worker + profuse sweating + dizziness + nausea + mild confusion — heat exhaustion",
      "Athlete collapsed in heat + hot skin + seizures + altered consciousness"
    ],
    "condition_mapping": [
      {"pattern": "core temp >40°C + CNS dysfunction + hot dry skin + hot environment", "suspected": "Classic Heat Stroke — Emergency"},
      {"pattern": "profuse sweating + dizziness + pale + normal mental status", "suspected": "Heat Exhaustion — Urgent but not Emergency"},
      {"pattern": "heat stroke + multiorgan failure + coagulopathy", "suspected": "Severe Heat Stroke with Multi-organ Failure"}
    ],
    "red_flags": ["temperature >40°C", "CNS dysfunction", "seizures", "absent sweating in hot environment", "shock"],
    "urgency_level": "Emergency",
    "forward_to": "108 Ambulance / ESIC Hospital",
    "notes": "Cooling is the primary treatment — remove from heat, cool with wet sheets + fans, cold packs to groin/neck/axillae. Target temperature <38.5°C in 30 min. ESIC covers occupational heat stroke."
  },
  {
    "group_id": "OCC_003",
    "group_name": "OCCUPATIONAL INJURIES (ESIC-RELEVANT)",
    "condition_name": "Chemical Exposure at Workplace (Inhalation/Skin)",
    "trigger_keywords": ["chemical factory accident", "gas leak workplace", "chemical on skin", "toxic fumes inhaled", "paint thinner exposure", "industrial gas inhalation", "chemical spill"],
    "probing_questions": [
      "What chemical was involved — is there an MSDS (material safety data sheet)?",
      "Was it inhaled, ingested, or skin/eye contact?",
      "How long was the exposure?",
      "Is there coughing, choking, or breathing difficulty?",
      "Is there skin burning or blistering?",
      "Is the person confused or losing consciousness?",
      "Was adequate PPE (personal protective equipment) worn?",
      "Are other workers also affected?"
    ],
    "chief_complaint_patterns": [
      "Factory gas leak + multiple workers with coughing + shortness of breath + eye burning",
      "Chemical splashed on skin + burning + blisters + systemic symptoms",
      "Chlorine/ammonia inhalation + pulmonary oedema + severe respiratory distress"
    ],
    "condition_mapping": [
      {"pattern": "toxic gas inhalation + respiratory distress + pulmonary oedema", "suspected": "Toxic Inhalational Injury — Chemical Pneumonitis"},
      {"pattern": "multiple workers affected + same exposure + mass casualty", "suspected": "Industrial Chemical Mass Casualty Incident"},
      {"pattern": "carbon monoxide exposure (CO) + headache + confusion + cherry-red skin", "suspected": "Carbon Monoxide Poisoning — High-flow O2 urgently"}
    ],
    "red_flags": ["respiratory failure", "multiple casualties", "CO poisoning (enclosed space)", "cyanide exposure (industrial fires)", "skin burns with systemic symptoms"],
    "urgency_level": "Emergency",
    "forward_to": "108 Ambulance / ESIC Hospital / Industrial Toxic Exposure Unit",
    "notes": "Remove from exposure first (safely — do not enter without PPE). CO poisoning: high-flow oxygen. Poison control helpline: 1800-116-117. ESIC covers occupational injuries — document exposure details."
  },
  {
    "group_id": "OCC_004",
    "group_name": "OCCUPATIONAL INJURIES (ESIC-RELEVANT)",
    "condition_name": "Machine-Related Amputation / Crush Injury",
    "trigger_keywords": ["machine katna", "factory amputation", "cut by machine", "hand caught in machine", "industrial crush injury", "haath machine mein kata", "de-gloving injury"],
    "probing_questions": [
      "What part of the body is injured?",
      "Is there active bleeding — is it controlled?",
      "Is there a complete or partial amputation?",
      "Has the amputated part been recovered and preserved?",
      "How long ago did the injury happen?",
      "Is the person conscious and haemodynamically stable?",
      "Is there a crushing mechanism — for how long was the limb trapped?",
      "Any contamination of the wound?"
    ],
    "chief_complaint_patterns": [
      "Factory worker with hand caught in press — partial or complete amputation of fingers",
      "Crush injury to lower limb — trapped for 30 minutes — risk of rhabdomyolysis",
      "De-gloving injury to hand/forearm from conveyor belt"
    ],
    "condition_mapping": [
      {"pattern": "traumatic amputation + active bleeding + haemodynamic compromise", "suspected": "Traumatic Amputation with Haemorrhagic Shock"},
      {"pattern": "crush injury + prolonged entrapment + dark urine + oliguria", "suspected": "Crush Syndrome / Rhabdomyolysis / AKI"},
      {"pattern": "clean guillotine amputation + within 6 hours + amputated part preserved", "suspected": "Replantation Candidate — Urgent Hand Surgery"}
    ],
    "red_flags": ["haemodynamic shock", "prolonged entrapment", "major limb loss", "dark urine post-crush"],
    "urgency_level": "Emergency",
    "forward_to": "108 Ambulance / ESIC Hospital with Surgery / Replantation Centre",
    "notes": "Control bleeding with direct pressure/tourniquet. Preserve amputated part in CLEAN damp cloth in a sealed bag, place on ice (do NOT freeze directly or submerge in water). Call 108. ESIC covers industrial accidents."
  },
  {
    "group_id": "CHRONIC_001",
    "group_name": "CHRONIC DISEASE EXACERBATIONS",
    "condition_name": "Decompensated Liver Failure (Hepatic Encephalopathy)",
    "trigger_keywords": ["liver patient confused", "cirrhosis confused", "yellow skin confused", "liver failure unconscious", "piliya aur behoshi", "jaundie unconscious"],
    "probing_questions": [
      "Does the patient have known liver cirrhosis or chronic liver disease?",
      "Is there new confusion or altered behaviour?",
      "Is there worsening jaundice?",
      "Is there abdominal swelling (ascites)?",
      "Is there any blood in the stool or vomiting blood?",
      "Any recent infections — especially abdominal pain (spontaneous bacterial peritonitis)?",
      "Any recent diuretic, lactulose, or medicine changes?",
      "Is there a bad smell on breath (fetor hepaticus)?"
    ],
    "chief_complaint_patterns": [
      "Cirrhosis patient with new-onset confusion + flap tremor + worsening jaundice — hepatic encephalopathy",
      "Cirrhosis + fever + abdominal pain + new ascites — suspect spontaneous bacterial peritonitis",
      "Cirrhosis + haematemesis + shock — variceal bleed"
    ],
    "condition_mapping": [
      {"pattern": "cirrhosis + confusion + asterixis + elevated ammonia", "suspected": "Hepatic Encephalopathy"},
      {"pattern": "cirrhosis + ascites + fever + abdominal pain", "suspected": "Spontaneous Bacterial Peritonitis (SBP)"},
      {"pattern": "cirrhosis + haematemesis + shock", "suspected": "Variceal Haemorrhage — Emergency"}
    ],
    "red_flags": ["GCS decline in liver patient", "variceal haemorrhage", "spontaneous bacterial peritonitis", "hepatorenal syndrome (oliguria)"],
    "urgency_level": "Emergency",
    "forward_to": "108 Ambulance / ESIC Hospital with Hepatology/GI",
    "notes": "Lactulose for encephalopathy. IV albumin for SBP. Terlipressin/octreotide + endoscopy for variceal bleed. Call 108."
  },
  {
    "group_id": "CHRONIC_002",
    "group_name": "CHRONIC DISEASE EXACERBATIONS",
    "condition_name": "CKD Exacerbation / Dialysis Emergency",
    "trigger_keywords": ["dialysis patient sick", "kidney patient not passed urine", "peshab band kidney", "missed dialysis", "dialysis line problem", "CKD emergency"],
    "probing_questions": [
      "Is the patient on regular dialysis — when was the last session?",
      "Is there swelling of the legs or face?",
      "Is there breathlessness (pulmonary oedema from fluid overload)?",
      "Is there confusion or altered consciousness?",
      "Is there chest pain (pericarditis with uraemia)?",
      "What is the serum potassium level — is it very high?",
      "Any ECG changes?",
      "Any access (fistula/line) problem?"
    ],
    "chief_complaint_patterns": [
      "Haemodialysis patient — missed 2 sessions + severe breathlessness + ECG showing peaked T waves (hyperkalaemia)",
      "CKD patient with nausea, confusion, creatinine very high — uraemic encephalopathy",
      "Dialysis patient with severe fluid overload + pulmonary oedema + low SpO2"
    ],
    "condition_mapping": [
      {"pattern": "dialysis patient + missed session + ECG changes + hyperkalaemia", "suspected": "Hyperkalaemia in ESKD — Cardiac Emergency"},
      {"pattern": "CKD + confusion + very high creatinine + asterixis", "suspected": "Uraemic Encephalopathy"},
      {"pattern": "CKD + severe dyspnoea + bilateral crackles + oliguria", "suspected": "Fluid Overload / Pulmonary Oedema in CKD"}
    ],
    "red_flags": ["hyperkalaemia ECG changes", "missed dialysis >2 sessions", "pulmonary oedema", "uraemic encephalopathy"],
    "urgency_level": "Emergency",
    "forward_to": "108 Ambulance / ESIC Hospital with Nephrology/Dialysis Unit",
    "notes": "Hyperkalaemia with ECG changes = cardiac emergency. IV calcium gluconate, insulin-dextrose, salbutamol nebulisation. Urgent dialysis. Call 108."
  },
  {
    "group_id": "CHRONIC_003",
    "group_name": "CHRONIC DISEASE EXACERBATIONS",
    "condition_name": "Sickle Cell Crisis (Vaso-occlusive / Acute Chest Syndrome)",
    "trigger_keywords": ["sickle cell dard", "sickle cell crisis", "severe bone pain sickle", "chest pain sickle cell", "sickling crisis"],
    "probing_questions": [
      "Is there known sickle cell disease?",
      "Where is the pain — bones, abdomen, chest?",
      "Is there a fever or signs of infection (precipitant)?",
      "Is there shortness of breath or chest pain?",
      "Is there any neurological symptoms — stroke symptoms?",
      "Is the patient well hydrated?",
      "How does this compare to usual crises?",
      "Any recent trigger — cold, dehydration, infection, altitude?"
    ],
    "chief_complaint_patterns": [
      "Known SCD patient with severe bone pain crisis + fever + dehydration",
      "Sickle cell patient with chest pain + fever + falling SpO2 — Acute Chest Syndrome",
      "Sickle cell patient with stroke symptoms — cerebral vaso-occlusion"
    ],
    "condition_mapping": [
      {"pattern": "SCD + chest pain + fever + falling SpO2 + infiltrates on CXR", "suspected": "Acute Chest Syndrome — Leading cause of death in SCD"},
      {"pattern": "SCD + severe bone pain + fever + dehydration", "suspected": "Vaso-occlusive Crisis"},
      {"pattern": "SCD + stroke symptoms + severe headache", "suspected": "Cerebral Vaso-occlusion / Stroke in SCD"}
    ],
    "red_flags": ["Acute Chest Syndrome (chest pain + falling SpO2)", "stroke symptoms", "priapism", "aplastic crisis (pale + very low Hb)", "splenic sequestration in child"],
    "urgency_level": "Emergency (ACS, stroke) / Urgent (VOC)",
    "forward_to": "108 for ACS/stroke; ESIC Hospital Haematology for VOC",
    "notes": "Acute Chest Syndrome: O2, exchange transfusion, broad-spectrum antibiotics. VOC: IV fluids, analgesia, oxygen. Avoid cold."
  },
  {
    "group_id": "CHRONIC_004",
    "group_name": "CHRONIC DISEASE EXACERBATIONS",
    "condition_name": "Hypertensive Emergency",
    "trigger_keywords": ["BP very high", "blood pressure 200", "high BP headache", "blurred vision high BP", "hypertensive emergency", "BP zyada sir dard", "malignant hypertension"],
    "probing_questions": [
      "What is the blood pressure reading?",
      "Is there a severe headache?",
      "Is there visual disturbance — blurring or loss of vision?",
      "Is there chest pain or shortness of breath?",
      "Any neurological symptoms — weakness, speech problems?",
      "Is the patient on blood pressure medications — have they been taken?",
      "Any recent cocaine or recreational drug use?",
      "Is the patient pregnant (pre-eclampsia risk)?"
    ],
    "chief_complaint_patterns": [
      "BP 220/130 + severe headache + blurred vision + papilloedema — hypertensive emergency",
      "Very high BP + chest pain + ECG changes — hypertensive emergency with target organ damage",
      "Severe hypertension + neurological deficit — hypertensive encephalopathy or ICH"
    ],
    "condition_mapping": [
      {"pattern": "BP >180/120 + target organ damage (CNS, heart, kidney)", "suspected": "Hypertensive Emergency (with end-organ damage)"},
      {"pattern": "BP >180/120 + no symptoms + no end-organ damage", "suspected": "Hypertensive Urgency (without end-organ damage)"},
      {"pattern": "very high BP + papilloedema + neurological signs", "suspected": "Hypertensive Encephalopathy / Malignant Hypertension"}
    ],
    "red_flags": ["BP >180/120 with any symptoms", "papilloedema", "neurological deficit", "chest pain", "acute kidney injury", "pregnancy"],
    "urgency_level": "Emergency (hypertensive emergency with end-organ damage) / Urgent (hypertensive urgency)",
    "forward_to": "108 for emergency; ESIC Hospital same-day for urgency",
    "notes": "Hypertensive emergency: controlled BP reduction over hours (not minutes) with IV agents. Do NOT drop BP too quickly — risk of cerebral ischaemia. Hypertensive urgency: oral agents, close follow-up."
  },
  {
    "group_id": "TROPICAL_006",
    "group_name": "TROPICAL / INFECTIOUS (INDIA-SPECIFIC)",
    "condition_name": "Japanese Encephalitis",
    "trigger_keywords": ["JE fever Assam", "mosquito bite brain fever", "paddy field fever with fits", "Japanese brain fever", "JE ward Assam", "encephalitis rural fever"],
    "probing_questions": [
      "Is the patient from a paddy-farming area or rural Assam?",
      "Is there high fever with rapidly progressive altered consciousness?",
      "Any seizures?",
      "Any extrapyramidal features — tremors, mask-like face, rigidity?",
      "Is there neck stiffness?",
      "Is the patient unvaccinated against JE?",
      "Is this during monsoon or post-monsoon season (peak JE season)?",
      "Any preceding prodrome of fever, headache, and vomiting for 2–3 days before neurological onset?"
    ],
    "chief_complaint_patterns": [
      "Unvaccinated rural farmer in Assam, post-monsoon, with fever + fits + coma",
      "Child from Assam with JE immunisation not given + fever + severe encephalopathy",
      "Febrile encephalopathy in NE India — JE most common cause"
    ],
    "condition_mapping": [
      {"pattern": "rural Assam + monsoon + fever + encephalopathy + seizures", "suspected": "Japanese Encephalitis (JE)"},
      {"pattern": "JE + Parkinsonian features + hydrocephalus on imaging", "suspected": "JE with CNS Complications"},
      {"pattern": "JE + acute flaccid paralysis", "suspected": "JE with Polio-like syndrome"}
    ],
    "red_flags": ["coma", "seizures", "rapid deterioration", "acute flaccid paralysis", "young child from endemic area"],
    "urgency_level": "Emergency",
    "forward_to": "108 Ambulance / ESIC Hospital / Government JE Referral Centre / Gauhati Medical College",
    "notes": "No specific antiviral treatment for JE. Supportive care, seizure control, ICP management. JE vaccination is part of India's UIP. Notifiable disease — report to IDSP and state health department. Assam has highest JE burden in India."
  },
  {
    "group_id": "PAED_005",
    "group_name": "PAEDIATRIC CONDITIONS",
    "condition_name": "Epiglottitis",
    "trigger_keywords": ["child drooling fever", "unable to swallow child", "muffled voice child fever", "sitting forward drooling", "tripod position child"],
    "probing_questions": [
      "Is the child sitting forward, leaning, and drooling (tripod position)?",
      "Is there a high fever?",
      "Is the voice muffled or 'hot potato' quality?",
      "Is there a sore throat and severe difficulty swallowing?",
      "Is there stridor?",
      "Is the child vaccinated against Hib (H. influenzae type b)?",
      "How quickly did the symptoms come on?",
      "Is there respiratory distress?"
    ],
    "chief_complaint_patterns": [
      "Unvaccinated child with rapid onset high fever + drooling + stridor + tripod sitting — epiglottitis",
      "Adult with severe sore throat + difficulty swallowing + muffled voice + stridor",
      "Child with sudden-onset sore throat, high fever, and leaning forward to breathe"
    ],
    "condition_mapping": [
      {"pattern": "sudden severe sore throat + drooling + tripod + Hib-unvaccinated", "suspected": "Acute Epiglottitis — Airway Emergency"},
      {"pattern": "epiglottitis + complete airway obstruction", "suspected": "Epiglottitis with Respiratory Arrest"},
      {"pattern": "adult epiglottitis + immunocompromised", "suspected": "Adult Epiglottitis"}
    ],
    "red_flags": ["drooling", "tripod position", "stridor", "rapidly deteriorating", "cyanosis"],
    "urgency_level": "Emergency",
    "forward_to": "108 Ambulance / ESIC Hospital with Paediatrics, ENT and Anaesthesia",
    "notes": "DO NOT examine the throat — can precipitate total airway obstruction. Keep calm, do NOT agitate child. Anaesthetist/ENT must be present for airway management. Call 108 immediately."
  },
  {
    "group_id": "OPHTHAL_003",
    "group_name": "OPHTHALMOLOGICAL EMERGENCIES",
    "condition_name": "Central Retinal Artery Occlusion",
    "trigger_keywords": ["sudden vision loss painless", "eye blind suddenly", "aankh achanak andhi", "curtain over vision eye", "painless sudden blindness one eye"],
    "probing_questions": [
      "Was the vision loss sudden and painless?",
      "Is it complete or partial vision loss?",
      "Is it in one eye or both?",
      "How long ago did it happen?",
      "Is there any pain in the eye?",
      "Any history of hypertension, diabetes, atrial fibrillation, or carotid artery disease?",
      "Any recent TIA or stroke symptoms?",
      "Is the patient a smoker?"
    ],
    "chief_complaint_patterns": [
      "Sudden complete painless vision loss in one eye in hypertensive patient — CRAO",
      "Amaurosis fugax: vision gone like a curtain for a few minutes then returned — TIA",
      "Sudden partial vision loss (inferior or superior field) — branch retinal artery occlusion"
    ],
    "condition_mapping": [
      {"pattern": "sudden painless complete monocular vision loss + hypertension/AF history", "suspected": "Central Retinal Artery Occlusion (CRAO)"},
      {"pattern": "transient monocular blindness + carotid disease", "suspected": "Amaurosis Fugax / TIA"},
      {"pattern": "painless visual field defect + gradual onset", "suspected": "Branch Retinal Artery/Vein Occlusion"}
    ],
    "red_flags": ["complete sudden vision loss", "concurrent stroke symptoms", "bilateral vision loss"],
    "urgency_level": "Emergency",
    "forward_to": "108 Ambulance / ESIC Hospital with Ophthalmology",
    "notes": "CRAO is 'eye stroke.' Window for treatment is very narrow (60-90 minutes). Urgent ophthalmology. Associated with systemic vascular disease — concurrent stroke workup needed."
  },
  {
    "group_id": "GI_006",
    "group_name": "GASTROINTESTINAL CONDITIONS",
    "condition_name": "Peptic Ulcer Disease with Perforation",
    "trigger_keywords": ["sudden severe stomach pain", "stomach pain like knife", "pet mein katne jaisi dard", "NSAID stomach ulcer", "perforated ulcer", "rigid abdomen suddenly"],
    "probing_questions": [
      "Did the pain come on suddenly and severely?",
      "Is the abdomen rigid or board-like?",
      "Was there a history of peptic ulcer or NSAID/steroid use?",
      "Is the pain worse with any movement?",
      "Is there shoulder tip pain (diaphragmatic irritation)?",
      "Any vomiting?",
      "Is there fever?",
      "Has the patient had a previous perforation?"
    ],
    "chief_complaint_patterns": [
      "Sudden severe epigastric pain + rigid abdomen + guarding + peritonism — perforated peptic ulcer",
      "NSAID user with sudden knife-like pain and board-like abdomen",
      "Peptic ulcer patient with pain suddenly becoming much worse and spreading"
    ],
    "condition_mapping": [
      {"pattern": "sudden severe epigastric pain + rigid board-like abdomen + NSAID history", "suspected": "Perforated Peptic Ulcer — Surgical Emergency"},
      {"pattern": "peptic ulcer + episodic epigastric pain + no peritonism", "suspected": "Active Peptic Ulcer Disease (non-emergency)"},
      {"pattern": "perforation + shock + peritonitis", "suspected": "Perforated PUD with Peritonitis and Septic Shock"}
    ],
    "red_flags": ["sudden severe abdominal pain", "rigid abdomen", "peritonism", "haemodynamic shock"],
    "urgency_level": "Emergency",
    "forward_to": "108 Ambulance / ESIC Hospital with General Surgery",
    "notes": "NBM, IV access, call 108. Perforation = emergency laparotomy. Every hour of delay increases mortality."
  },
  {
    "group_id": "OBS_006",
    "group_name": "OBSTETRIC / GYNAECOLOGICAL CONDITIONS",
    "condition_name": "Miscarriage / Threatened Abortion",
    "trigger_keywords": ["bleeding in pregnancy", "pregnancy loss", "garbapal mein khoon", "miscarriage", "bachha gir gaya", "bleeding early pregnancy", "cramps in pregnancy"],
    "probing_questions": [
      "How many weeks pregnant is she?",
      "How much bleeding — spotting or heavy?",
      "Is there associated cramping pain?",
      "Has she passed any tissue?",
      "Is this a first pregnancy or has she had miscarriages before?",
      "Is she feeling faint or dizzy?",
      "Has she had any pelvic infection?",
      "Was this a planned pregnancy — any IVF?"
    ],
    "chief_complaint_patterns": [
      "8-week pregnancy + light bleeding + mild cramps + closed cervix — threatened abortion",
      "12-week pregnancy + heavy bleeding + tissue passed + open cervix — incomplete abortion",
      "Early pregnancy loss + heavy bleeding + haemodynamic compromise — complete/incomplete with haemorrhage"
    ],
    "condition_mapping": [
      {"pattern": "early pregnancy + bleeding + closed cervix + viable fetus on scan", "suspected": "Threatened Miscarriage"},
      {"pattern": "early pregnancy + bleeding + open cervix + tissue passed", "suspected": "Incomplete Miscarriage — needs evacuation"},
      {"pattern": "early pregnancy + heavy bleeding + shock", "suspected": "Miscarriage with Haemorrhagic Shock — Emergency"}
    ],
    "red_flags": ["haemodynamic instability", "heavy bleeding soaking pads", "signs of septic abortion (fever + offensive discharge)", "shoulder tip pain (rule out ectopic)"],
    "urgency_level": "Emergency (haemodynamic compromise) / Urgent (heavy bleeding) / Routine (threatened, stable)",
    "forward_to": "108 for emergency; ESIC Hospital Gynaecology for urgent; ESIS Dispensary for stable",
    "notes": "Always exclude ectopic pregnancy. Septic abortion (post-abortion fever + offensive discharge) is a severe emergency. Rh-negative patients need anti-D."
  },
  {
    "group_id": "ENDOCRINE_005",
    "group_name": "ENDOCRINE CONDITIONS",
    "condition_name": "Hyperosmolar Hyperglycaemic State (HHS)",
    "trigger_keywords": ["very high blood sugar no ketones", "elderly diabetic confused", "Type 2 diabetic dehydrated confused", "blood sugar 500", "HHS", "HONK"],
    "probing_questions": [
      "Is the patient elderly with Type 2 diabetes?",
      "Is the blood sugar extremely high (>30 mmol/L or >540 mg/dL)?",
      "Is there profound dehydration?",
      "Is the patient confused or altered in consciousness?",
      "Is there a precipitant — infection, MI, stroke?",
      "Are there ketones in the urine (typically minimal or absent in HHS)?",
      "When did the patient last drink adequate fluids?",
      "Any history of diuretic use that worsened dehydration?"
    ],
    "chief_complaint_patterns": [
      "Elderly T2DM with blood glucose >40 mmol/L + profound dehydration + confusion + no ketones",
      "Nursing home patient with T2DM + missed medications + infection + very high glucose + altered GCS",
      "HHS with osmolality >320 + serum glucose >33 + altered consciousness"
    ],
    "condition_mapping": [
      {"pattern": "elderly T2DM + very high glucose + no ketones + profound dehydration + confusion", "suspected": "Hyperosmolar Hyperglycaemic State (HHS)"},
      {"pattern": "HHS + DVT or stroke (hyperviscosity complication)", "suspected": "HHS with Thrombotic Complication"},
      {"pattern": "very high glucose + ketones + vomiting", "suspected": "DKA (distinguish from HHS)"}
    ],
    "red_flags": ["serum glucose >33 mmol/L", "altered consciousness", "profound dehydration", "thrombosis risk", "precipitating illness"],
    "urgency_level": "Emergency",
    "forward_to": "108 Ambulance / ESIC Hospital with ICU/HDU",
    "notes": "Fluid replacement is key (often 8-10L deficit). Insulin infusion at lower rate than DKA. Anticoagulation for VTE prophylaxis. Treat precipitant. Slow correction to prevent cerebral oedema."
  },
  {
    "group_id": "NEURO_008",
    "group_name": "NEUROLOGICAL CONDITIONS",
    "condition_name": "Acute Vertigo / Labyrinthine Emergency",
    "trigger_keywords": ["sudden spinning", "chakkar aana bahut", "cannot walk dizziness", "vertigo sudden", "room spinning vomiting", "BPPV", "vestibular"],
    "probing_questions": [
      "Is the dizziness a spinning sensation (true vertigo) or just lightheadedness?",
      "Did it start suddenly?",
      "Is there nausea and vomiting?",
      "Is there any hearing loss or ringing in the ears (tinnitus)?",
      "Are there any neurological symptoms — double vision, facial numbness, difficulty walking, slurred speech?",
      "Does it worsen with head position changes?",
      "Is there headache?",
      "Any history of ear infection or recent head injury?"
    ],
    "chief_complaint_patterns": [
      "Sudden severe vertigo + vomiting + unable to stand + NO neurological symptoms — vestibular neuritis",
      "Vertigo + double vision + facial numbness + falling — posterior circulation stroke (PICA territory)",
      "Positional vertigo — vertigo on turning in bed — BPPV"
    ],
    "condition_mapping": [
      {"pattern": "sudden severe vertigo + nausea + no neurological deficit + gaze-evoked nystagmus", "suspected": "Vestibular Neuritis / Labyrinthitis"},
      {"pattern": "vertigo + diplopia + dysphagia + facial numbness + limb ataxia", "suspected": "Posterior Circulation Stroke (Wallenberg Syndrome)"},
      {"pattern": "episodic positional vertigo + nystagmus on Dix-Hallpike", "suspected": "BPPV"}
    ],
    "red_flags": ["neurological symptoms with vertigo", "sudden onset vertigo in vascular risk patients", "severe headache with vertigo", "falls with neurological deficit"],
    "urgency_level": "Emergency (if neurological signs) / Urgent (if first severe episode)",
    "forward_to": "108 if neurological signs; ESIC Hospital ENT/Neurology for severe first episode",
    "notes": "Posterior stroke can mimic vestibular disorders. Any neurological sign + vertigo = posterior stroke until proven otherwise. HINTS exam (Head Impulse, Nystagmus type, Test of skew) can help clinicians differentiate."
  },
  {
    "group_id": "PSYCH_004",
    "group_name": "PSYCHIATRIC EMERGENCIES",
    "condition_name": "Severe Alcohol Withdrawal / Delirium Tremens",
    "trigger_keywords": ["alcohol withdrawal fits", "DT alcohol", "delirium tremens", "shaking stopped drinking", "alcohol shakes fits", "withdrawal seizure alcoholic"],
    "probing_questions": [
      "Is the person a chronic heavy alcohol drinker who has recently stopped or reduced?",
      "Is there tremor, sweating, or agitation within 6-24 hours of stopping?",
      "Are there visual hallucinations — seeing things like insects or spiders?",
      "Is there a rapid heart rate or high blood pressure?",
      "Any seizures?",
      "Is the person confused or delirious?",
      "Is there fever?",
      "Any previous delirium tremens or withdrawal seizures?"
    ],
    "chief_complaint_patterns": [
      "Chronic alcoholic stopped drinking 2 days ago + tremor + visual hallucinations + seizures — DT",
      "Post-operative patient with alcohol history becoming agitated and hallucinating 48h post-op — occult DT",
      "Alcohol withdrawal seizure 24h after last drink in chronic alcoholic"
    ],
    "condition_mapping": [
      {"pattern": "alcohol cessation + tremor + hallucinations + seizures + fever + tachycardia", "suspected": "Delirium Tremens (DT) — Life-threatening"},
      {"pattern": "alcohol cessation + mild tremor + anxiety + no hallucinations", "suspected": "Alcohol Withdrawal Syndrome (mild)"},
      {"pattern": "alcohol withdrawal + Wernicke's encephalopathy (confusion + ataxia + eye signs)", "suspected": "Wernicke's Encephalopathy — IV Thiamine urgently"}
    ],
    "red_flags": ["seizures", "hallucinations", "high fever", "severe agitation", "previous severe withdrawal", "Wernicke's features"],
    "urgency_level": "Emergency",
    "forward_to": "108 Ambulance / ESIC Hospital Casualty",
    "notes": "DT has 5-15% mortality untreated. IV/IM benzodiazepines are first-line. IV thiamine 200-500mg BEFORE any glucose (to prevent precipitating Wernicke's). CIWA protocol for monitoring."
  }
];
export default clinicalProtocols;
