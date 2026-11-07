// AI Weather & Campus Hazard Advisory Engine
// Connects to global meteorological satellite data via Open-Meteo
// Generates predictive campus emergency analyses and student safety protocols

// WMO Weather Interpretation Codes
const WMO_MAP = {
  0: { label: 'Clear Sky', icon: 'sunny', color: '#FABC11', bg: '#FEF9E7', category: 'clear' },
  1: { label: 'Mainly Clear', icon: 'partly-sunny', color: '#FABC11', bg: '#FEF9E7', category: 'clear' },
  2: { label: 'Partly Cloudy', icon: 'cloudy', color: '#0284C7', bg: '#E0F2FE', category: 'cloudy' },
  3: { label: 'Overcast', icon: 'cloud', color: '#475569', bg: '#F1F5F9', category: 'cloudy' },
  45: { label: 'Foggy / Low Visibility', icon: 'cloud-offline', color: '#64748B', bg: '#F1F5F9', category: 'fog' },
  48: { label: 'Dense Fog', icon: 'cloud-offline', color: '#475569', bg: '#E2E8F0', category: 'fog' },
  51: { label: 'Light Drizzle', icon: 'rainy', color: '#0284C7', bg: '#E0F2FE', category: 'rain' },
  53: { label: 'Moderate Drizzle', icon: 'rainy', color: '#2563EB', bg: '#EFF6FF', category: 'rain' },
  55: { label: 'Dense Drizzle', icon: 'rainy', color: '#1D4ED8', bg: '#DBEAFE', category: 'rain' },
  61: { label: 'Slight Rain', icon: 'rainy', color: '#0284C7', bg: '#E0F2FE', category: 'rain' },
  63: { label: 'Moderate Rain', icon: 'rainy', color: '#2563EB', bg: '#EFF6FF', category: 'rain' },
  65: { label: 'Heavy Torrential Rain', icon: 'thunderstorm', color: '#1E40AF', bg: '#DBEAFE', category: 'heavy_rain' },
  80: { label: 'Rain Showers', icon: 'rainy', color: '#0284C7', bg: '#E0F2FE', category: 'rain' },
  81: { label: 'Moderate Rain Showers', icon: 'rainy', color: '#2563EB', bg: '#EFF6FF', category: 'rain' },
  82: { label: 'Violent Rain Showers', icon: 'thunderstorm', color: '#DC2626', bg: '#FEE2E2', category: 'heavy_rain' },
  95: { label: 'Severe Thunderstorm', icon: 'thunderstorm', color: '#DC2626', bg: '#FEE2E2', category: 'thunderstorm' },
  96: { label: 'Thunderstorm with Hail', icon: 'thunderstorm', color: '#991B1B', bg: '#FEE2E2', category: 'thunderstorm' },
  99: { label: 'Severe Hailstorm', icon: 'thunderstorm', color: '#7F1D1D', bg: '#FEE2E2', category: 'thunderstorm' },
};

/**
 * Fetch real-time weather data based on latitude and longitude.
 * Falls back to default campus coordinates if GPS is unavailable.
 */
export async function fetchLiveWeather(lat = 14.5995, lng = 120.9842) {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m`;
    const res = await Promise.race([
      fetch(url),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Weather timeout')), 7000)),
    ]);

    if (!res.ok) throw new Error(`Weather service responded with ${res.status}`);
    const data = await res.json();
    const cur = data.current || {};

    const code = cur.weather_code ?? 0;
    const info = WMO_MAP[code] || WMO_MAP[0];

    return {
      temp: Math.round(cur.temperature_2m ?? 28),
      feelsLike: Math.round(cur.apparent_temperature ?? cur.temperature_2m ?? 30),
      humidity: Math.round(cur.relative_humidity_2m ?? 70),
      windSpeed: Math.round(cur.wind_speed_10m ?? 8),
      precipitation: cur.precipitation ?? 0,
      code,
      label: info.label,
      icon: info.icon,
      color: info.color,
      bg: info.bg,
      category: info.category,
      updatedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
  } catch (e) {
    // Return dependable default meteorological estimate (tropical campus default)
    return {
      temp: 31,
      feelsLike: 35,
      humidity: 75,
      windSpeed: 10,
      precipitation: 0,
      code: 1,
      label: 'Mainly Clear / High Heat Index',
      icon: 'sunny',
      color: '#FABC11',
      bg: '#FEF9E7',
      category: 'clear',
      updatedAt: 'Live Estimate',
      isOfflineFallback: true,
    };
  }
}

/**
 * AI Hazard & Risk Intelligence Engine:
 * Evaluates current meteorological variables and generates predicted campus emergencies
 * along with step-by-step student preparation protocols.
 */
export function generateHazardAnalysis(weather) {
  const { temp, feelsLike, windSpeed, precipitation, category, humidity } = weather;

  let riskLevel = 'LOW'; // LOW | ELEVATED | HIGH | CRITICAL
  let riskColor = '#24652B';
  let riskBg = '#EDF6EE';
  let bannerSummary = 'Weather is calm. Campus operations proceeding normally.';
  const predictedEmergencies = [];
  const preparations = [];
  const gearChecklist = [];

  // 1. Extreme Heat & Sun Exposure Analysis
  if (feelsLike >= 38 || temp >= 34) {
    riskLevel = feelsLike >= 42 ? 'CRITICAL' : 'HIGH';
    riskColor = '#DC2626';
    riskBg = '#FEF2F2';
    bannerSummary = `High Heat Index (${feelsLike}°C). Danger of heat cramps, exhaustion, and fainting during classes.`;

    predictedEmergencies.push({
      title: 'Heatstroke & Sudden Fainting',
      type: 'medical',
      probability: '85%',
      severity: 'High',
      color: '#EF4444',
      bg: '#FEE2E2',
      desc: 'Students exposed to afternoon heat in non-airconditioned rooms or open grounds may suffer dehydration and loss of consciousness.',
      warningSign: 'Dizziness, heavy sweating, confusion, nausea, or rapid pulse.',
    });

    predictedEmergencies.push({
      title: 'Dehydration & Low Blood Pressure',
      type: 'medical',
      probability: '70%',
      severity: 'Moderate',
      color: '#F59E0B',
      bg: '#FFFBEB',
      desc: 'Fatigue and headaches leading to classroom collapse, especially after physical education activities.',
      warningSign: 'Extreme thirst, dry mouth, dark urine, and lightheadedness.',
    });

    preparations.push({
      step: 'Hydration Routine',
      detail: 'Drink at least 250ml of water every hour. Do not wait until feeling thirsty.',
      icon: 'water-outline',
      priority: 'CRITICAL',
    });
    preparations.push({
      step: 'Avoid Outdoor Activities Between 11 AM - 3 PM',
      detail: 'Stay under shaded corridors or air-conditioned study lounges during peak solar radiation.',
      icon: 'sunny-outline',
      priority: 'HIGH',
    });
    preparations.push({
      step: 'Identify Clinic Locations',
      detail: 'Know the nearest campus clinic or medical bay in case a classmate suddenly faints.',
      icon: 'medkit-outline',
      priority: 'MODERATE',
    });

    gearChecklist.push('Reusable Water Bottle (min 1 Liter)');
    gearChecklist.push('Handheld Portable Fan / Cooling Mist');
    gearChecklist.push('Electrolyte Salts or Oral Rehydration Pack');
    gearChecklist.push('Umbrella / Wide-Brim Sun Hat');
  } else if (feelsLike >= 33) {
    riskLevel = 'ELEVATED';
    riskColor = '#B88000';
    riskBg = '#FEF9E7';
    bannerSummary = `Warm conditions (${temp}°C, feels like ${feelsLike}°C). Maintain hydration throughout the day.`;

    predictedEmergencies.push({
      title: 'Heat Exhaustion',
      type: 'medical',
      probability: '45%',
      severity: 'Moderate',
      color: '#B88000',
      bg: '#FEF9E7',
      desc: 'Prolonged exposure during physical sports or assemblies can lead to fainting and weakness.',
      warningSign: 'Profuse sweating, fatigue, and muscle cramps.',
    });

    preparations.push({
      step: 'Regular Water Intake',
      detail: 'Refill your water tumbler at campus hydration stations between classes.',
      icon: 'water-outline',
      priority: 'HIGH',
    });
    gearChecklist.push('Water Bottle');
    gearChecklist.push('Pocket Towel / Handkerchief');
  }

  // 2. Thunderstorm & Lightning Hazards
  if (category === 'thunderstorm') {
    riskLevel = 'CRITICAL';
    riskColor = '#DC2626';
    riskBg = '#FEF2F2';
    bannerSummary = 'Active Thunderstorm Alert: Threat of ground lightning, power surges, and severe downpours.';

    predictedEmergencies.push({
      title: 'Lightning Strike Hazard in Open Areas',
      type: 'fight',
      probability: '90%',
      severity: 'Critical',
      color: '#DC2626',
      bg: '#FEE2E2',
      desc: 'Extremely dangerous on open football fields, bleachers, rooftop courts, and near tall metal poles or trees.',
      warningSign: 'Frequent cloud-to-ground flashes and thunder claps within 10 seconds of flash.',
    });

    predictedEmergencies.push({
      title: 'Power Outage & Classroom Trapping',
      type: 'accident',
      probability: '65%',
      severity: 'Moderate',
      color: '#D97706',
      bg: '#FEF3C7',
      desc: 'Sudden brownouts can leave stairways and elevators without illumination, triggering panic or falls.',
      warningSign: 'Flickering lights or loud transformer pops outside building.',
    });

    preparations.push({
      step: 'Immediate Indoor Shelter Protocol',
      detail: 'Move inside an enclosed concrete structure immediately. DO NOT stay in open sheds, gazebos, or under isolated trees.',
      icon: 'home-outline',
      priority: 'CRITICAL',
    });
    preparations.push({
      step: 'Avoid Elevators During Thunderstorms',
      detail: 'Use interior stairwells to prevent getting stuck if local substation power fails.',
      icon: 'alert-circle-outline',
      priority: 'HIGH',
    });
    preparations.push({
      step: 'Unplug Sensitive Electronics',
      detail: 'Avoid charging laptops/phones near window outlets prone to voltage spikes.',
      icon: 'flash-off-outline',
      priority: 'MODERATE',
    });

    gearChecklist.push('High-Power Flashlight / Phone Torch');
    gearChecklist.push('Charged Power Bank');
    gearChecklist.push('Sturdy Umbrella / Raincoat');
  }

  // 3. Heavy Torrential Rain & Flooding
  if (category === 'heavy_rain' || precipitation >= 3) {
    if (riskLevel !== 'CRITICAL') {
      riskLevel = 'HIGH';
      riskColor = '#2563EB';
      riskBg = '#EFF6FF';
    }
    bannerSummary = 'Heavy Torrential Rain: Flash flood danger in low campus grounds and slippery tiled stairs.';

    predictedEmergencies.push({
      title: 'Slip & Fall on Wet Corridor Tiles',
      type: 'accident',
      probability: '80%',
      severity: 'High',
      color: '#D97706',
      bg: '#FEF3C7',
      desc: 'Smooth polished hallway tiles and wet metal stair nosings become highly slippery when wet shoes track rain inside.',
      warningSign: 'Water pooling at building entrance mats and hallway ramps.',
    });

    predictedEmergencies.push({
      title: 'Flash Flooding in Ground-Floor Areas',
      type: 'other',
      probability: '75%',
      severity: 'High',
      color: '#2563EB',
      bg: '#EFF6FF',
      desc: 'Drainage overflow can submerge courtyard pathways, parking gates, and ground-floor computer laboratories.',
      warningSign: 'Rising muddy water in drainage ditches near perimeter walls.',
    });

    preparations.push({
      step: 'Walk Deliberately & Use Handrails',
      detail: 'Hold stair handrails firmly. Never run or rush along wet outdoor corridors.',
      icon: 'walk-outline',
      priority: 'HIGH',
    });
    preparations.push({
      step: 'Relocate to 2nd Floor or Above',
      detail: 'If ground floor corridors begin taking in water, move student bags and electronics upstairs.',
      icon: 'arrow-up-circle-outline',
      priority: 'HIGH',
    });

    gearChecklist.push('Waterproof Bag Cover / Zip Pouches');
    gearChecklist.push('Shoes with High-Traction Rubber Grips');
    gearChecklist.push('Full Raincoat or Windproof Umbrella');
  } else if (category === 'rain' && riskLevel === 'LOW') {
    riskLevel = 'ELEVATED';
    riskColor = '#0284C7';
    riskBg = '#E0F2FE';
    bannerSummary = 'Light to Moderate Rain: Damp pathways and wet stair treads. Caution recommended.';

    predictedEmergencies.push({
      title: 'Slip & Fall Hazard',
      type: 'accident',
      probability: '50%',
      severity: 'Moderate',
      color: '#D97706',
      bg: '#FEF3C7',
      desc: 'Wet surfaces on pedestrian crosswalks and ramps increase danger of sprains and bruises.',
      warningSign: 'Wet footprints on building entrances.',
    });

    preparations.push({
      step: 'Wipe Shoes on Entrance Mats',
      detail: 'Help keep building floors dry for other students by thoroughly wiping shoes upon entry.',
      icon: 'footsteps-outline',
      priority: 'MODERATE',
    });
    gearChecklist.push('Pocket Umbrella');
  }

  // 4. High Gale Wind Hazards
  if (windSpeed >= 28) {
    if (riskLevel !== 'CRITICAL') {
      riskLevel = 'HIGH';
      riskColor = '#8B5CF6';
      riskBg = '#F5F3FF';
    }

    predictedEmergencies.push({
      title: 'Falling Tree Branches & Blown Debris',
      type: 'accident',
      probability: '75%',
      severity: 'High',
      color: '#8B5CF6',
      bg: '#F5F3FF',
      desc: 'High wind gusts can dislodge dead tree limbs, unfastened corrugated roofing, or loose signage across campus courtyards.',
      warningSign: 'Trees visibly swaying violently and rattling roof panels.',
    });

    preparations.push({
      step: 'Avoid Walking Directly Under Canopy Trees',
      detail: 'Take designated covered walkways rather than cutting through tree-lined perimeter paths.',
      icon: 'leaf-outline',
      priority: 'HIGH',
    });
  }

  // Fallback if everything is pleasant & clear
  if (predictedEmergencies.length === 0) {
    predictedEmergencies.push({
      title: 'Routine Campus Operations',
      type: 'other',
      probability: '10%',
      severity: 'Low',
      color: '#24652B',
      bg: '#EDF6EE',
      desc: 'No significant weather-related hazards detected at this hour. General campus safety guidelines apply.',
      warningSign: 'None. Maintain situational awareness.',
    });

    preparations.push({
      step: 'Standard Campus Awareness',
      detail: 'Keep emergency hotlines handy and know the location of emergency exits and first-aid kits.',
      icon: 'shield-checkmark-outline',
      priority: 'STANDARD',
    });

    gearChecklist.push('Student ID & Emergency Contact Card');
    gearChecklist.push('Hydration Tumbler');
  }

  return {
    riskLevel,
    riskColor,
    riskBg,
    bannerSummary,
    predictedEmergencies,
    preparations,
    gearChecklist,
  };
}

/**
 * Intelligent Safety Q&A Assistant:
 * Provides immediate actionable answers to common student weather-emergency queries.
 */
export function getAiSafetyAdvice(question, weather) {
  const q = question.toLowerCase();

  if (q.includes('faint') || q.includes('heat') || q.includes('collapse') || q.includes('dizzy')) {
    return {
      title: 'Heatstroke & Fainting Response Protocol',
      steps: [
        'Move the victim immediately to a cool, shaded, or air-conditioned area.',
        'Loosen tight clothing (collars, ties, belts) to improve ventilation.',
        'Elevate their legs 6 to 12 inches to restore blood flow to the brain.',
        'Apply cool, wet towels or ice packs to the neck, armpits, and groin.',
        'If conscious, give sips of cool water (do NOT give fluids if unconscious).',
        'Press the SOS button on this app to dispatch school medical responders immediately.',
      ],
      alertType: 'medical',
    };
  }

  if (q.includes('lightning') || q.includes('thunder') || q.includes('storm')) {
    return {
      title: 'Campus Lightning Safety Protocol (30/30 Rule)',
      steps: [
        'If thunder is heard within 30 seconds of lightning flash, seek enclosed indoor shelter immediately.',
        'Stay away from tall metal bleachers, soccer goalposts, chain-link fences, and flagpoles.',
        'Do not take shelter under solitary trees; a tree behaves as a natural lightning rod.',
        'Avoid taking showers or washing hands during violent thunderstorms due to plumbing conduction.',
        'Wait 30 minutes after the last clap of thunder before heading outdoors.',
      ],
      alertType: 'fight',
    };
  }

  if (q.includes('flood') || q.includes('stuck') || q.includes('water')) {
    return {
      title: 'Campus Flood & Heavy Rain Protocol',
      steps: [
        'Never walk through moving floodwater; 6 inches of rapid water can sweep an adult off balance.',
        'Stay clear of submerged electrical outlets, street lamps, and flooded electrical posts (electrocution risk).',
        'Move immediately to the second floor of campus buildings if ground water begins rising.',
        'Alert campus responders via this app if anyone is stranded in lower basements or laboratories.',
      ],
      alertType: 'other',
    };
  }

  if (q.includes('slip') || q.includes('fall') || q.includes('stairs')) {
    return {
      title: 'Slippery Surfaces & Fall Prevention',
      steps: [
        'Always maintain 3 points of contact on staircases: keep at least one hand on the handrail.',
        'Do not look down at your phone screen while walking down wet ramps or stairs.',
        'Take shorter, wider steps on polished marble or tile entrance ways.',
        'If someone falls and cannot stand, do not force them up (risk of fracture). Call responders.',
      ],
      alertType: 'accident',
    };
  }

  // Default general safety guidance
  return {
    title: 'General Campus Safety Advice',
    steps: [
      `Current campus weather is ${weather.temp}°C (${weather.label}).`,
      'Stay inside designated campus safety zones during adverse weather.',
      'Always keep your phone charged so security responders can pinpoint your GPS coordinates.',
      'Use the red SOS button on your home screen for immediate emergency assistance.',
    ],
    alertType: 'other',
  };
}
