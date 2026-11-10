import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { api } from '../api';
import { useAuth } from '../auth';
import { CAMPUS_CONFIG, EMERGENCY_NUMBER } from '../config';
import { Avatar, Badge, Btn, Card, Field, Header, TOP, TypeIcon } from '../ui';
import { ACTIVE, C, SHADOWS, STATUS, TYPES, fmtTime, timeAgo, typeInfo } from '../theme';
import { fetchLiveWeather, generateHazardAnalysis, getAiSafetyAdvice } from '../services/weatherAi';
import { checkCampusGeofence } from '../services/geofence';
import OffCampusModal from '../components/OffCampusModal';

export default function StudentHome() {
  const { user, logout, socket, updateUser } = useAuth();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [composing, setComposing] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [weatherModalOpen, setWeatherModalOpen] = useState(false);
  const [selectedType, setSelectedType] = useState(null);
  const [prefilledNote, setPrefilledNote] = useState('');

  // Campus Geofence & Boundary States
  const [userCoords, setUserCoords] = useState(null);
  const [demoOnCampus, setDemoOnCampus] = useState(false);

  // AI Weather & Hazard States
  const [weather, setWeather] = useState(null);
  const [hazardAnalysis, setHazardAnalysis] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [presence, setPresence] = useState({ activeResponders: 0, activeUsers: 1 });

  const load = useCallback(async () => {
    try {
      const { reports: list } = await api.get('/api/reports/mine');
      setReports(list);
    } catch {
      // keep existing reports
    } finally {
      setLoading(false);
    }
  }, []);

  const loadWeather = useCallback(async () => {
    setWeatherLoading(true);
    try {
      let lat = CAMPUS_CONFIG.latitude;
      let lng = CAMPUS_CONFIG.longitude;
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status === 'granted') {
        try {
          const pos = await Promise.race([
            Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 4000)),
          ]);
          lat = pos.coords.latitude;
          lng = pos.coords.longitude;
          setUserCoords({ lat, lng });
        } catch {
          // fallback to default campus coordinates
          setUserCoords({ lat: CAMPUS_CONFIG.latitude, lng: CAMPUS_CONFIG.longitude });
        }
      } else {
        setUserCoords({ lat: CAMPUS_CONFIG.latitude, lng: CAMPUS_CONFIG.longitude });
      }
      const data = await fetchLiveWeather(lat, lng);
      setWeather(data);
      setHazardAnalysis(generateHazardAnalysis(data));
    } catch {
      // ignore
    } finally {
      setWeatherLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    loadWeather();
    const t = setInterval(load, 20000);
    const tw = setInterval(loadWeather, 300000); // 5 min weather refresh
    return () => {
      clearInterval(t);
      clearInterval(tw);
    };
  }, [load, loadWeather]);

  // Live status updates from responders & presence
  useEffect(() => {
    if (!socket) return undefined;
    const onUpdate = (r) => setReports((prev) => prev.map((x) => (x.id === r.id ? r : x)));
    const onPresence = (data) => {
      if (data) setPresence(data);
    };
    socket.on('report:update', onUpdate);
    socket.on('presence:update', onPresence);
    socket.on('connect', load);
    return () => {
      socket.off('report:update', onUpdate);
      socket.off('presence:update', onPresence);
      socket.off('connect', load);
    };
  }, [socket, load]);

  const active = reports.find((r) => ACTIVE.includes(r.status));
  const past = reports.filter((r) => !ACTIVE.includes(r.status));

  const onSent = (report) => {
    setReports((prev) => [report, ...prev.filter((x) => x.id !== report.id)]);
    setComposing(false);
    setSelectedType(null);
    setPrefilledNote('');
  };

  const handleQuickTrigger = (typeKey = null, note = '') => {
    setSelectedType(typeKey);
    setPrefilledNote(note);
    setComposing(true);
  };

  const cancelAlert = () =>
    Alert.alert(
      'Cancel this SOS alert?',
      'Only cancel if this was submitted by mistake or you have reached safety.',
      [
        { text: 'Keep Alert Active', style: 'cancel' },
        {
          text: 'Yes, Cancel Alert',
          style: 'destructive',
          onPress: async () => {
            try {
              const { report } = await api.patch(`/api/reports/${active.id}/cancel`);
              setReports((prev) => prev.map((x) => (x.id === report.id ? report : x)));
            } catch (e) {
              Alert.alert('Could not cancel', e.message);
            }
          },
        },
      ]
    );

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Top Header with Student Profile and Weather Shortcut */}
      <View style={s.topHeader}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setProfileOpen(true)}
          style={s.profileHeaderBtn}
        >
          <View style={{ position: 'relative' }}>
            <Avatar uri={user?.avatar} name={user?.name} size="md" color={C.indigo} />
            <View style={s.onlineDot} />
          </View>
          <View style={{ marginLeft: 12, flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={s.greetingName} numberOfLines={1}>
                {user?.name?.split(' ')[0]}
              </Text>
              <Badge text="STUDENT" color={C.blue} bg={C.blueBg} size="sm" />
            </View>
            <Text style={s.greetingSub}>
              {user?.idNumber ? `ID: ${user.idNumber}` : 'Tap to edit profile'}
            </Text>
          </View>
        </TouchableOpacity>

        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {weather ? (
            <TouchableOpacity
              onPress={() => setWeatherModalOpen(true)}
              style={s.weatherHeaderPill}
              activeOpacity={0.75}
            >
              <Ionicons name={weather.icon} size={16} color={weather.color} style={{ marginRight: 4 }} />
              <Text style={s.weatherHeaderTemp}>{weather.temp}°C</Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            onPress={() => setProfileOpen(true)}
            style={s.profilePill}
            activeOpacity={0.75}
          >
            <Ionicons name="person-circle" size={17} color={C.indigo} style={{ marginRight: 3 }} />
            <Text style={s.profilePillText}>Profile</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 18, paddingBottom: 48 }}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={() => {
              load();
              loadWeather();
            }}
            tintColor={C.blue}
          />
        }
      >
        {loading ? (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={C.blue} />
            <Text style={{ color: C.sub, marginTop: 12, fontSize: 13 }}>Connecting to Dispatch...</Text>
          </View>
        ) : active ? (
          <ActiveIncidentCard report={active} onCancel={cancelAlert} />
        ) : (
          <View>
            {/* Campus Security Network Status Bar */}
            <View style={s.statusBar}>
              <View
                style={[
                  s.statusPulse,
                  { backgroundColor: presence.activeResponders > 0 ? C.green : C.amber },
                ]}
              />
              <Text style={s.statusText}>
                {presence.activeResponders > 0
                  ? `${presence.activeResponders} RESPONDER${presence.activeResponders > 1 ? 'S' : ''} ON DUTY • REAL-TIME DISPATCH ACTIVE`
                  : 'CAMPUS DISPATCH STANDBY'}
              </Text>
            </View>

            {/* AI Weather Hazard Advisory Widget */}
            {weather && hazardAnalysis ? (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setWeatherModalOpen(true)}
                style={[s.weatherCard, { borderColor: hazardAnalysis.riskColor }]}
              >
                <View style={s.weatherCardHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <View style={[s.weatherIconCircle, { backgroundColor: weather.bg }]}>
                      <Ionicons name={weather.icon} size={24} color={weather.color} />
                    </View>
                    <View style={{ marginLeft: 10, flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={s.weatherTempText}>{weather.temp}°C</Text>
                        <Text style={s.weatherFeelsText}> (Feels {weather.feelsLike}°C)</Text>
                      </View>
                      <Text style={s.weatherLabelText} numberOfLines={1}>{weather.label}</Text>
                    </View>
                  </View>

                  <View style={[s.riskBadge, { backgroundColor: hazardAnalysis.riskBg, borderColor: hazardAnalysis.riskColor }]}>
                    <Ionicons name="sparkles" size={12} color={hazardAnalysis.riskColor} style={{ marginRight: 4 }} />
                    <Text style={[s.riskBadgeText, { color: hazardAnalysis.riskColor }]}>
                      {hazardAnalysis.riskLevel} RISK
                    </Text>
                  </View>
                </View>

                {/* AI Warning Summary */}
                <View style={[s.hazardSummaryRow, { backgroundColor: hazardAnalysis.riskBg }]}>
                  <Ionicons name="warning" size={16} color={hazardAnalysis.riskColor} style={{ marginRight: 6, marginTop: 1 }} />
                  <Text style={[s.hazardSummaryText, { color: hazardAnalysis.riskColor }]}>
                    {hazardAnalysis.bannerSummary}
                  </Text>
                </View>

                <View style={s.weatherCardFooter}>
                  <Text style={s.weatherCardActionText}>
                    View {hazardAnalysis.predictedEmergencies.length} predicted hazards & preparation checklist
                  </Text>
                  <Ionicons name="chevron-forward" size={14} color={C.blue} />
                </View>
              </TouchableOpacity>
            ) : null}

            {/* Campus Geofence Boundary Status Banner */}
            {(() => {
              const geofence = checkCampusGeofence(userCoords, demoOnCampus);
              return (
                <View style={s.campusBoundaryCard}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <View
                      style={[
                        s.boundaryIconCircle,
                        { backgroundColor: geofence.isInsideCampus ? '#DCFCE7' : '#FEF3C7' },
                      ]}
                    >
                      <Ionicons
                        name={geofence.isInsideCampus ? 'shield-checkmark' : 'warning'}
                        size={18}
                        color={geofence.isInsideCampus ? C.green : '#B45309'}
                      />
                    </View>
                    <View style={{ marginLeft: 10, flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={s.boundaryTitleText}>
                          {geofence.isInsideCampus
                            ? 'SNSU MAIN CAMPUS ACTIVE'
                            : 'OUTSIDE CAMPUS BOUNDARY'}
                        </Text>
                        <View
                          style={[
                            s.liveDot,
                            { backgroundColor: geofence.isInsideCampus ? C.green : C.amber },
                          ]}
                        />
                      </View>
                      <Text style={s.boundarySubText} numberOfLines={1}>
                        {geofence.isInsideCampus
                          ? `Inside ${CAMPUS_CONFIG.radiusMeters}m Safe Zone • Campus Responders Ready`
                          : `~${geofence.distanceFormatted} from SNSU • 911 Hotline Fallback Ready`}
                      </Text>
                    </View>
                  </View>

                  {/* Demo Simulation Switch for Thesis Defense */}
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => setDemoOnCampus((v) => !v)}
                    style={[s.demoToggleBtn, demoOnCampus && s.demoToggleBtnActive]}
                  >
                    <Ionicons
                      name={demoOnCampus ? 'checkbox' : 'square-outline'}
                      size={13}
                      color={demoOnCampus ? C.green : C.sub}
                      style={{ marginRight: 4 }}
                    />
                    <Text
                      style={[s.demoToggleText, demoOnCampus && s.demoToggleTextActive]}
                    >
                      {demoOnCampus ? 'Demo: On-Campus' : 'Simulate Inside'}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })()}

            {/* Central SOS Button Hero with Concentric Radar Waves */}
            <View style={s.sosHeroContainer}>
              <View style={s.sosOuterRing3}>
                <View style={s.sosOuterRing2}>
                  <View style={s.sosOuterRing1}>
                    <TouchableOpacity
                      activeOpacity={0.82}
                      onPress={() => handleQuickTrigger(null)}
                      style={s.sosMainBtn}
                    >
                      <MaterialCommunityIcons name="broadcast" size={36} color="#FFF1F2" />
                      <Text style={s.sosMainText}>SOS</Text>
                      <Text style={s.sosSubText}>TAP FOR HELP</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
              <Text style={s.sosNotice}>
                Pressing SOS instantly transmits your GPS location and alerts all on-duty campus safety officers.
              </Text>
            </View>

            {/* Quick Emergency Category Selector */}
            <View style={s.sectionHeaderRow}>
              <Text style={s.sectionHeader}>OR CHOOSE AN EMERGENCY TYPE</Text>
              <View style={s.badgePill}>
                <Text style={s.badgePillText}>{TYPES.length} Categories</Text>
              </View>
            </View>

            <View style={s.typeGrid}>
              {TYPES.map((t) => (
                <TouchableOpacity
                  key={t.key}
                  activeOpacity={0.78}
                  onPress={() => handleQuickTrigger(t.key)}
                  style={[s.typeTile, { borderLeftColor: t.color }]}
                >
                  <View style={[s.typeIconBox, { backgroundColor: t.bg }]}>
                    <TypeIcon typeKey={t.key} size={22} color={t.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.typeTitle, { color: C.text }]}>{t.label}</Text>
                    <Text style={s.typeDesc} numberOfLines={1}>{t.desc}</Text>
                  </View>
                  <View style={[s.arrowCircle, { backgroundColor: t.bg }]}>
                    <Ionicons name="chevron-forward" size={14} color={t.color} />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Emergency Call Hotline Banner */}
        <View style={s.hotlineCard}>
          <View style={s.hotlineIcon}>
            <Ionicons name="call" size={20} color={C.forest} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.hotlineTitle}>Direct Campus Security Hotline</Text>
            <Text style={s.hotlineDesc}>Immediate line to campus security: {EMERGENCY_NUMBER}</Text>
          </View>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => Linking.openURL(`tel:${EMERGENCY_NUMBER}`)}
            style={s.hotlineBtn}
          >
            <Ionicons name="call" size={14} color="#0E2012" style={{ marginRight: 4 }} />
            <Text style={s.hotlineBtnText}>CALL</Text>
          </TouchableOpacity>
        </View>

        {/* Past Reports History */}
        {past.length > 0 && (
          <View style={{ marginTop: 26 }}>
            <Text style={s.sectionHeader}>YOUR INCIDENT HISTORY</Text>
            {past.map((r) => {
              const st = STATUS[r.status] || STATUS.open;
              const t = typeInfo(r.type);
              return (
                <Card key={r.id} style={s.historyCard}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={[s.historyIcon, { backgroundColor: t.bg }]}>
                      <TypeIcon typeKey={r.type} size={20} color={t.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.historyTitle}>{t.label}</Text>
                      <Text style={s.historyTime}>
                        {fmtTime(r.createdAt)} • {r.locationText || 'GPS Coords'}
                      </Text>
                    </View>
                    <Badge text={st.short} color={st.color} bg={st.bg} size="sm" />
                  </View>
                </Card>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Compose Incident Modal */}
      <ComposeModal
        visible={composing}
        initialType={selectedType}
        initialNote={prefilledNote}
        onClose={() => {
          setComposing(false);
          setSelectedType(null);
          setPrefilledNote('');
        }}
        onSent={onSent}
        demoOnCampus={demoOnCampus}
      />

      {/* Student Profile Dashboard Modal */}
      <StudentProfileModal
        visible={profileOpen}
        user={user}
        onClose={() => setProfileOpen(false)}
        onUpdated={updateUser}
        onLogout={logout}
      />

      {/* AI Weather Safety & Hazard Forecast Modal */}
      <WeatherSafetyModal
        visible={weatherModalOpen}
        weather={weather}
        analysis={hazardAnalysis}
        onClose={() => setWeatherModalOpen(false)}
        onRefresh={loadWeather}
        onTriggerSos={(typeKey, note) => {
          setWeatherModalOpen(false);
          handleQuickTrigger(typeKey, note);
        }}
      />
    </View>
  );
}

// AI Weather Safety & Hazard Forecast Center Modal
function WeatherSafetyModal({ visible, weather, analysis, onClose, onRefresh, onTriggerSos }) {
  const [activeAdvice, setActiveAdvice] = useState(null);
  const [selectedTopic, setSelectedTopic] = useState('faint');

  useEffect(() => {
    if (visible && weather) {
      setActiveAdvice(getAiSafetyAdvice('faint', weather));
      setSelectedTopic('faint');
    }
  }, [visible, weather]);

  if (!weather || !analysis) return null;

  const handleTopic = (topicKey, query) => {
    setSelectedTopic(topicKey);
    setActiveAdvice(getAiSafetyAdvice(query, weather));
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        {/* Header */}
        <View style={s.modalHeader}>
          <TouchableOpacity onPress={onClose} style={s.closeModalBtn}>
            <Ionicons name="close" size={22} color={C.text} />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>

              <Text style={s.modalTitle}>AI WEATHER & HAZARD ADVISOR</Text>
            </View>
            <Text style={s.modalSub}>Predictive Campus Emergency Intelligence</Text>
          </View>
          <TouchableOpacity onPress={onRefresh} style={s.refreshHeaderBtn}>
            <Ionicons name="refresh" size={18} color={C.blue} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 50 }}>
          {/* Live Weather HUD Banner */}
          <View style={[s.weatherHudCard, { borderColor: weather.color }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={[s.weatherHudIcon, { backgroundColor: weather.bg }]}>
                  <Ionicons name={weather.icon} size={36} color={weather.color} />
                </View>
                <View style={{ marginLeft: 12 }}>
                  <Text style={s.hudTempText}>{weather.temp}°C</Text>
                  <Text style={s.hudConditionText}>{weather.label}</Text>
                  <Text style={s.hudFeelsText}>Apparent Temp: {weather.feelsLike}°C</Text>
                </View>
              </View>

              <View style={[s.hudRiskBadge, { backgroundColor: analysis.riskBg, borderColor: analysis.riskColor }]}>
                <MaterialCommunityIcons name="shield-alert" size={18} color={analysis.riskColor} />
                <Text style={[s.hudRiskText, { color: analysis.riskColor }]}>{analysis.riskLevel}</Text>
                <Text style={s.hudRiskSub}>THREAT</Text>
              </View>
            </View>

            {/* Micro Sensor Grid */}
            <View style={s.sensorGrid}>
              <View style={s.sensorTile}>
                <Ionicons name="water-outline" size={16} color={C.blue} />
                <Text style={s.sensorVal}>{weather.humidity}%</Text>
                <Text style={s.sensorLabel}>Humidity</Text>
              </View>
              <View style={s.sensorTile}>
                <Ionicons name="speedometer-outline" size={16} color={C.amber} />
                <Text style={s.sensorVal}>{weather.windSpeed} km/h</Text>
                <Text style={s.sensorLabel}>Wind Speed</Text>
              </View>
              <View style={s.sensorTile}>
                <Ionicons name="rainy-outline" size={16} color={C.teal} />
                <Text style={s.sensorVal}>{weather.precipitation} mm</Text>
                <Text style={s.sensorLabel}>Precipitation</Text>
              </View>
              <View style={s.sensorTile}>
                <Ionicons name="time-outline" size={16} color={C.sub} />
                <Text style={s.sensorVal}>{weather.updatedAt}</Text>
                <Text style={s.sensorLabel}>Updated</Text>
              </View>
            </View>
          </View>

          {/* AI Threat Summary */}
          <View style={[s.threatBanner, { backgroundColor: analysis.riskBg, borderColor: analysis.riskColor }]}>
            <Ionicons name="alert-circle" size={20} color={analysis.riskColor} style={{ marginRight: 8, marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <Text style={[s.threatTitle, { color: analysis.riskColor }]}>AI CAMPUS RISK ADVISORY</Text>
              <Text style={s.threatDesc}>{analysis.bannerSummary}</Text>
            </View>
          </View>

          {/* Section: Predicted Emergencies to Watch For */}
          <Text style={s.sectionTitle}>PREDICTED EMERGENCIES TO WATCH FOR</Text>
          <Text style={s.sectionSub}>Generated by analyzing current weather against campus incident history</Text>

          <View style={{ gap: 10, marginTop: 10 }}>
            {analysis.predictedEmergencies.map((em, idx) => (
              <View key={idx} style={[s.hazardCard, { borderLeftColor: em.color }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={s.hazardCardTitle}>{em.title}</Text>
                  <View style={[s.probBadge, { backgroundColor: em.bg }]}>
                    <Text style={[s.probText, { color: em.color }]}>{em.probability} Risk</Text>
                  </View>
                </View>

                <Text style={s.hazardDesc}>{em.desc}</Text>

                <View style={s.warningSignBox}>
                  <Text style={s.warningSignLabel}>⚠️ WARNING SIGNS IN CLASSMATES:</Text>
                  <Text style={s.warningSignText}>{em.warningSign}</Text>
                </View>

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => onTriggerSos(em.type, `Weather hazard: Witnessed ${em.title}`)}
                  style={s.reportHazardBtn}
                >
                  <Ionicons name="warning" size={14} color={C.red} style={{ marginRight: 4 }} />
                  <Text style={s.reportHazardBtnText}>Report this incident now via SOS</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>

          {/* Section: What Students Should Prepare */}
          <Text style={[s.sectionTitle, { marginTop: 24 }]}>WHAT STUDENTS SHOULD PREPARE</Text>
          <Text style={s.sectionSub}>Recommended safety protocols for classes and outdoor campus traversal</Text>

          <View style={{ gap: 8, marginTop: 10 }}>
            {analysis.preparations.map((prep, i) => (
              <View key={i} style={s.prepCard}>
                <View style={s.prepIconCircle}>
                  <Ionicons name={prep.icon || 'shield-checkmark-outline'} size={20} color={C.blue} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={s.prepStepTitle}>{prep.step}</Text>
                    <Badge
                      text={prep.priority}
                      color={prep.priority === 'CRITICAL' ? C.red : prep.priority === 'HIGH' ? C.amber : C.green}
                      size="sm"
                    />
                  </View>
                  <Text style={s.prepDetail}>{prep.detail}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Recommended Gear Checklist */}
          {analysis.gearChecklist.length > 0 && (
            <View style={s.gearCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                <Ionicons name="briefcase-outline" size={18} color={C.indigo} style={{ marginRight: 6 }} />
                <Text style={s.gearTitle}>CAMPUS GEAR SAFETY CHECKLIST</Text>
              </View>
              {analysis.gearChecklist.map((item, i) => (
                <View key={i} style={s.gearItemRow}>
                  <Ionicons name="checkbox" size={16} color={C.green} style={{ marginRight: 8 }} />
                  <Text style={s.gearItemText}>{item}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Interactive AI Safety Assistant Section */}
          <Text style={[s.sectionTitle, { marginTop: 24 }]}>ASK AI CAMPUS SAFETY ASSISTANT</Text>
          <Text style={s.sectionSub}>Instant first-response protocols for weather-related accidents</Text>

          <View style={s.qaTopicRow}>
            {[
              { key: 'faint', label: '🔥 Heatstroke / Faint', query: 'faint' },
              { key: 'lightning', label: '⚡ Lightning / Storm', query: 'lightning' },
              { key: 'flood', label: '🌊 Flood / Trap', query: 'flood' },
              { key: 'slip', label: '⚠️ Slip / Fall', query: 'slip' },
            ].map((tp) => (
              <TouchableOpacity
                key={tp.key}
                onPress={() => handleTopic(tp.key, tp.query)}
                style={[s.qaTopicChip, selectedTopic === tp.key && s.qaTopicChipActive]}
              >
                <Text style={[s.qaTopicText, selectedTopic === tp.key && s.qaTopicTextActive]}>
                  {tp.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {activeAdvice && (
            <View style={s.adviceCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                <Ionicons name="medical" size={18} color={C.blue} style={{ marginRight: 6 }} />
                <Text style={s.adviceTitle}>{activeAdvice.title}</Text>
              </View>
              {activeAdvice.steps.map((st, i) => (
                <View key={i} style={s.adviceStepRow}>
                  <View style={s.stepNumberBadge}>
                    <Text style={s.stepNumberText}>{i + 1}</Text>
                  </View>
                  <Text style={s.adviceStepText}>{st}</Text>
                </View>
              ))}
            </View>
          )}

          <Btn
            title="CLOSE SAFETY ADVISOR"
            onPress={onClose}
            outline
            color={C.sub}
            style={{ marginTop: 24 }}
          />
        </ScrollView>
      </View>
    </Modal>
  );
}

// Student Profile Dashboard Modal
function StudentProfileModal({ visible, user, onClose, onUpdated, onLogout }) {
  const [name, setName] = useState(user?.name || '');
  const [idNumber, setIdNumber] = useState(user?.idNumber || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [avatar, setAvatar] = useState(user?.avatar || null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible && user) {
      setName(user.name || '');
      setIdNumber(user.idNumber || '');
      setPhone(user.phone || '');
      setAvatar(user.avatar || null);
    }
  }, [visible, user]);

  const pickFromGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Allow photo library access in your settings to upload a profile picture.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.6,
        base64: true,
      });

      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        const base64Data = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
        setAvatar(base64Data);
      }
    } catch (e) {
      Alert.alert('Image Selection Failed', e.message);
    }
  };

  const takePhotoWithCamera = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Allow camera access in your settings to take a profile picture.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.6,
        base64: true,
      });

      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        const base64Data = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
        setAvatar(base64Data);
      }
    } catch (e) {
      Alert.alert('Camera Capture Failed', e.message);
    }
  };

  const chooseAvatarOption = () => {
    Alert.alert(
      'Profile Picture',
      'Select how you want to update your photo:',
      [
        { text: 'Choose from Gallery', onPress: pickFromGallery },
        { text: 'Take a Photo', onPress: takePhotoWithCamera },
        avatar ? { text: 'Remove Photo', style: 'destructive', onPress: () => setAvatar(null) } : null,
        { text: 'Cancel', style: 'cancel' },
      ].filter(Boolean)
    );
  };

  const saveProfile = async () => {
    if (!name.trim()) {
      Alert.alert('Validation Error', 'Full name is required.');
      return;
    }
    setSaving(true);
    try {
      const { user: updated } = await api.patch('/api/me', {
        name: name.trim(),
        idNumber: idNumber.trim(),
        phone: phone.trim(),
        avatar,
      });
      onUpdated(updated);
      Alert.alert('Profile Saved', 'Your student profile details have been successfully updated.');
      onClose();
    } catch (e) {
      Alert.alert('Save Failed', e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: C.bg }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Profile Header */}
        <View style={s.modalHeader}>
          <TouchableOpacity onPress={onClose} style={s.closeModalBtn}>
            <Ionicons name="close" size={22} color={C.text} />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={s.modalTitle}>STUDENT PROFILE</Text>
            <Text style={s.modalSub}>Campus Safety ID & Information</Text>
          </View>
          <TouchableOpacity onPress={saveProfile} disabled={saving} style={s.saveHeaderBtn}>
            {saving ? (
              <ActivityIndicator size="small" color={C.blue} />
            ) : (
              <Text style={s.saveHeaderText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 50 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Avatar Hero Banner */}
          <View style={s.avatarCard}>
            <View style={s.avatarContainer}>
              <Avatar uri={avatar} name={name} size="xl" color={C.indigo} />
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={chooseAvatarOption}
                style={s.cameraBadge}
              >
                <Ionicons name="camera" size={18} color="#0E2012" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={chooseAvatarOption}
              style={s.uploadPhotoBtn}
            >
              <Ionicons name="image-outline" size={16} color={C.indigo} style={{ marginRight: 6 }} />
              <Text style={s.uploadPhotoText}>
                {avatar ? 'Change Profile Picture' : 'Upload Profile Picture'}
              </Text>
            </TouchableOpacity>

            <View style={s.verifiedRow}>
              <Ionicons name="shield-checkmark" size={16} color={C.green} style={{ marginRight: 5 }} />
              <Text style={s.verifiedText}>Verified Campus Student Account</Text>
            </View>
          </View>

          {/* Profile Form */}
          <Text style={s.profileSectionTitle}>PERSONAL INFORMATION</Text>

          <Field
            label="Full Name"
            value={name}
            onChangeText={setName}
            placeholder="e.g. Maria Santos"
          />

          <Field
            label="Student ID Number"
            value={idNumber}
            onChangeText={setIdNumber}
            placeholder="e.g. 2024-10892"
            autoCapitalize="characters"
          />

          <Field
            label="Emergency Contact Phone"
            value={phone}
            onChangeText={setPhone}
            placeholder="e.g. 0917-123-4567"
            keyboardType="phone-pad"
            helper="Responders will dial this number when you transmit an emergency SOS."
          />

          {/* Account Details Card */}
          <Text style={[s.profileSectionTitle, { marginTop: 10 }]}>ACCOUNT SECURITY</Text>
          <View style={s.infoCard}>
            <View style={s.infoRow}>
              <Ionicons name="mail-outline" size={18} color={C.sub} style={{ marginRight: 10 }} />
              <View style={{ flex: 1 }}>
                <Text style={s.infoLabel}>REGISTERED EMAIL</Text>
                <Text style={s.infoValue}>{user?.email}</Text>
              </View>
              <Badge text="VERIFIED" color={C.green} bg={C.greenBg} size="sm" />
            </View>
            <View style={[s.infoRow, { marginTop: 12, borderTopWidth: 1, borderTopColor: C.borderLight, paddingTop: 10 }]}>
              <Ionicons name="time-outline" size={18} color={C.sub} style={{ marginRight: 10 }} />
              <View style={{ flex: 1 }}>
                <Text style={s.infoLabel}>ENROLLED SINCE</Text>
                <Text style={s.infoValue}>{fmtTime(user?.createdAt) || 'Recent'}</Text>
              </View>
            </View>
          </View>

          {/* Action Buttons */}
          <Btn
            title="SAVE PROFILE CHANGES"
            onPress={saveProfile}
            color={C.indigo}
            loading={saving}
            icon={<Ionicons name="checkmark-circle-outline" size={18} color="#fff" />}
            style={{ marginTop: 22, ...SHADOWS.md }}
          />

          <Btn
            title="Sign Out Iwatch"
            onPress={() => {
              onClose();
              onLogout();
            }}
            outline
            color={C.red}
            icon={<Ionicons name="log-out-outline" size={18} color={C.red} />}
            style={{ marginTop: 12 }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// Active Incident Display Card
function ActiveIncidentCard({ report, onCancel }) {
  const st = STATUS[report.status] || STATUS.open;
  const t = typeInfo(report.type);

  return (
    <View style={s.activeContainer}>
      <View style={[s.activeHeader, { backgroundColor: st.color }]}>
        <View style={s.activePulseBadge}>
          <View style={s.activeBlinkDot} />
          <Text style={s.activeStatusTitle}>{st.label.toUpperCase()}</Text>
        </View>
        <Text style={s.activeTimer}>Sent {timeAgo(report.createdAt)}</Text>
      </View>

      <View style={s.activeBody}>
        <View style={s.activeCategoryRow}>
          <View style={[s.activeIconCircle, { backgroundColor: t.bg }]}>
            <TypeIcon typeKey={report.type} size={30} color={t.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.activeCategoryTitle}>{t.label}</Text>
            <Text style={s.activeReportId}>Incident Case #{report.id}</Text>
          </View>
        </View>

        {report.responderName ? (
          <View style={s.responderBox}>
            <Ionicons name="shield-checkmark" size={24} color={C.blue} style={{ marginRight: 10 }} />
            <View style={{ flex: 1 }}>
              <Text style={s.responderLabel}>ASSIGNED RESPONDER</Text>
              <Text style={s.responderName}>{report.responderName}</Text>
              <Text style={s.responderSub}>Responder is on duty and handling your report</Text>
            </View>
          </View>
        ) : (
          <View style={s.waitingBox}>
            <ActivityIndicator size="small" color={C.amber} style={{ marginRight: 10 }} />
            <View style={{ flex: 1 }}>
              <Text style={s.waitingTitle}>Alerting Nearby Responders</Text>
              <Text style={s.waitingSub}>Campus security officers have been paged</Text>
            </View>
          </View>
        )}

        {/* Location Information */}
        <View style={s.activeLocRow}>
          <Ionicons name="location" size={20} color={C.red} style={{ marginRight: 8, marginTop: 2 }} />
          <View style={{ flex: 1 }}>
            <Text style={s.activeLocTitle}>DISPATCH LOCATION</Text>
            <Text style={s.activeLocText}>{report.locationText || 'GPS Coordinates Shared'}</Text>
            {report.lat ? (
              <Text style={s.coordsText}>
                LAT: {report.lat.toFixed(5)}, LNG: {report.lng.toFixed(5)}
              </Text>
            ) : null}
          </View>
        </View>

        {report.note ? (
          <View style={s.noteBox}>
            <Text style={s.noteTitle}>YOUR NOTE</Text>
            <Text style={s.noteContent}>{report.note}</Text>
          </View>
        ) : null}

        {/* Safety Advisory Banner */}
        <View style={s.advisoryBox}>
          <Ionicons name="information-circle" size={20} color={C.blue} style={{ marginRight: 8 }} />
          <Text style={s.advisoryText}>
            Stay where you are if safe to do so. Keep your phone with you and screen unlocked.
          </Text>
        </View>

        {/* Cancel button */}
        <Btn
          title="CANCEL ALERT (MISTAKE / I AM SAFE)"
          onPress={onCancel}
          outline
          color={C.sub}
          small
          style={{ marginTop: 14 }}
        />
      </View>
    </View>
  );
}

// Modal for Composing and Submitting Emergency SOS
function ComposeModal({ visible, initialType, initialNote, onClose, onSent, demoOnCampus = false }) {
  const [type, setType] = useState(initialType || null);
  const [loc, setLoc] = useState('');
  const [note, setNote] = useState(initialNote || '');
  const [coords, setCoords] = useState(null);
  const [gps, setGps] = useState('idle'); // idle | loading | ok | denied | failed
  const [sending, setSending] = useState(false);
  const [offCampusModalOpen, setOffCampusModalOpen] = useState(false);

  const getGps = useCallback(async () => {
    setGps('loading');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setGps('denied');
        return;
      }
      const pos = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 10000)),
      ]);
      setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy });
      setGps('ok');
    } catch {
      setGps('failed');
    }
  }, []);

  useEffect(() => {
    if (visible) {
      setType(initialType || null);
      setLoc('');
      setNote(initialNote || '');
      setCoords(null);
      setOffCampusModalOpen(false);
      getGps();
    }
  }, [visible, initialType, initialNote, getGps]);

  const geofence = checkCampusGeofence(coords, demoOnCampus);

  const send = async (forceOffCampus = false) => {
    // If GPS is locked and user is outside the 500m SNSU boundary, show 911 fallback modal
    if (coords && !geofence.isInsideCampus && !forceOffCampus) {
      setOffCampusModalOpen(true);
      return;
    }

    setSending(true);
    try {
      const finalLat = geofence.simulated ? CAMPUS_CONFIG.latitude : coords?.lat;
      const finalLng = geofence.simulated ? CAMPUS_CONFIG.longitude : coords?.lng;
      const { report } = await api.post('/api/reports', {
        type,
        locationText: loc.trim(),
        lat: finalLat,
        lng: finalLng,
        note: note.trim(),
        isOffCampus: !geofence.isInsideCampus,
        distanceToCampus: geofence.distanceMeters,
      });
      setOffCampusModalOpen(false);
      onSent(report);
    } catch (e) {
      if (e.status === 409 && e.data?.report) onSent(e.data.report);
      else Alert.alert('Submission Failed', e.message);
    } finally {
      setSending(false);
    }
  };

  const canSend = !!type && (loc.trim().length > 0 || !!coords);
  const displayedTypes = initialType ? TYPES.filter((t) => t.key === initialType) : TYPES;

  const gpsBadge = {
    loading: { text: 'Acquiring GPS location...', color: C.amber, icon: 'navigate-circle-outline' },
    ok: {
      text: `GPS coordinates locked ${coords?.acc ? `(±${Math.round(coords.acc)}m)` : ''}`,
      color: C.green,
      icon: 'checkmark-circle',
    },
    denied: { text: 'GPS access denied — please specify location below', color: C.red, icon: 'warning' },
    failed: { text: 'GPS signal weak — please specify location below', color: C.amber, icon: 'warning' },
    idle: { text: 'Requesting location...', color: C.sub, icon: 'navigate-outline' },
  }[gps];

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: C.bg }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={s.modalHeader}>
          <TouchableOpacity onPress={onClose} style={s.closeModalBtn}>
            <Ionicons name="close" size={24} color={C.text} />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={s.modalTitle}>EMERGENCY SOS DISPATCH</Text>
            <Text style={s.modalSub}>Campus Safety & Response Team</Text>
          </View>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Step 1: Emergency Type */}
          <Text style={[s.inputStepTitle, initialType && { textAlign: 'center' }]}>1. SELECT EMERGENCY CLASSIFICATION</Text>
          <View style={[s.modalTypeGrid, initialType && { justifyContent: 'center', alignItems: 'center' }]}>
            {displayedTypes.map((t) => {
              const selected = type === t.key;
              return (
                <TouchableOpacity
                  key={t.key}
                  activeOpacity={0.8}
                  onPress={() => setType(t.key)}
                  style={[
                    s.modalTypeCard,
                    selected && { borderColor: t.color, backgroundColor: t.bg, ...SHADOWS.sm },
                    initialType && {
                      width: '85%',
                      justifyContent: 'center',
                      alignSelf: 'center',
                      paddingVertical: 14,
                      paddingHorizontal: 16,
                      borderRadius: 14,
                    },
                  ]}
                >
                  <View style={[s.modalTypeIcon, { backgroundColor: selected ? '#fff' : t.bg }, initialType && { marginRight: 12 }]}>
                    <TypeIcon typeKey={t.key} size={22} color={t.color} />
                  </View>
                  <Text
                    style={[
                      s.modalTypeLabel,
                      selected && { color: t.color, fontWeight: '800' },
                      initialType && { fontSize: 16 },
                    ]}
                  >
                    {t.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Step 2: Location and GPS */}
          <Text style={[s.inputStepTitle, { marginTop: 18 }]}>2. LOCATION VERIFICATION</Text>
          <View style={s.gpsBox}>
            <Ionicons name={gpsBadge.icon} size={20} color={gpsBadge.color} style={{ marginRight: 8 }} />
            <Text style={[s.gpsStatusText, { color: gpsBadge.color }]}>{gpsBadge.text}</Text>
            {gps !== 'loading' && gps !== 'ok' ? (
              <TouchableOpacity onPress={getGps} style={s.retryGpsBtn}>
                <Text style={s.retryGpsText}>Retry</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Campus Geofence Verification Pill */}
          {coords ? (
            <View
              style={[
                s.geofencePill,
                {
                  backgroundColor: geofence.isInsideCampus ? '#DCFCE7' : '#FEF3C7',
                  borderColor: geofence.isInsideCampus ? '#86EFAC' : '#FDE68A',
                },
              ]}
            >
              <Ionicons
                name={geofence.isInsideCampus ? 'shield-checkmark' : 'warning'}
                size={14}
                color={geofence.isInsideCampus ? C.green : '#B45309'}
                style={{ marginRight: 6 }}
              />
              <Text
                style={[
                  s.geofencePillText,
                  { color: geofence.isInsideCampus ? C.green : '#92400E' },
                ]}
              >
                {geofence.isInsideCampus
                  ? `SNSU Main Campus Boundary Verified (Within ${CAMPUS_CONFIG.radiusMeters}m)`
                  : `Outside Campus Boundary (~${geofence.distanceFormatted} away • 911 Ready)`}
              </Text>
            </View>
          ) : null}

          <Field
            label="Specific Location (Building, Floor, Room)"
            value={loc}
            onChangeText={setLoc}
            placeholder="e.g. Science Building, 3rd Floor, Room 302"
            maxLength={200}
          />

          <Field
            label="Additional Details (Optional)"
            value={note}
            onChangeText={setNote}
            placeholder="e.g. Someone is injured, need immediate first aid"
            multiline
            maxLength={500}
            style={{ minHeight: 70, textAlignVertical: 'top' }}
          />

          {/* Submit Button */}
          <Btn
            title="TRANSMIT EMERGENCY SOS"
            onPress={() => send(false)}
            color={C.red}
            disabled={!canSend}
            loading={sending}
            icon={<Ionicons name="warning" size={20} color="#fff" />}
            style={{ paddingVertical: 16, marginTop: 12, ...SHADOWS.glow(C.red) }}
          />
          {!type ? (
            <Text style={s.modalHelpText}>Please choose an emergency type to dispatch assistance.</Text>
          ) : !loc.trim() && !coords ? (
            <Text style={s.modalHelpText}>Enter your location or allow GPS access to continue.</Text>
          ) : null}
        </ScrollView>

        {/* Intelligent 911 Fallback Modal when triggered outside campus */}
        <OffCampusModal
          visible={offCampusModalOpen}
          distanceFormatted={geofence.distanceFormatted}
          onProceedRecord={() => send(true)}
          onDismiss={() => setOffCampusModalOpen(false)}
        />
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  topHeader: {
    paddingTop: TOP,
    paddingBottom: 14,
    paddingHorizontal: 18,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  profileHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 6,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: C.green,
    borderWidth: 2,
    borderColor: '#fff',
  },
  greetingName: {
    fontSize: 18,
    fontWeight: '900',
    color: C.text,
    marginRight: 8,
  },
  greetingSub: {
    fontSize: 12,
    fontWeight: '600',
    color: C.sub,
    marginTop: 2,
  },
  weatherHeaderPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.cardSubtle,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    marginRight: 8,
  },
  weatherHeaderTemp: {
    fontSize: 12,
    fontWeight: '800',
    color: C.text,
  },
  profilePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.indigoBg,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.indigoBorder,
  },
  profilePillText: {
    fontSize: 12,
    fontWeight: '800',
    color: C.indigo,
  },

  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.greenBg,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: C.greenBorder,
    marginBottom: 14,
    alignSelf: 'center',
  },
  statusPulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.green,
    marginRight: 8,
  },
  statusText: {
    color: C.greenDark,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  // AI Weather Hazard Widget
  weatherCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1.5,
    marginBottom: 14,
    ...SHADOWS.sm,
  },
  weatherCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  weatherIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weatherTempText: {
    fontSize: 18,
    fontWeight: '900',
    color: C.text,
  },
  weatherFeelsText: {
    fontSize: 12,
    fontWeight: '600',
    color: C.sub,
  },
  weatherLabelText: {
    fontSize: 12,
    fontWeight: '700',
    color: C.sub,
    marginTop: 1,
  },
  riskBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
  },
  riskBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  hazardSummaryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
  },
  hazardSummaryText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
  weatherCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: C.borderLight,
    paddingTop: 8,
    marginTop: 10,
  },
  weatherCardActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: C.blue,
  },

  sosHeroContainer: {
    alignItems: 'center',
    marginVertical: 10,
  },
  sosOuterRing3: {
    width: 270,
    height: 270,
    borderRadius: 135,
    backgroundColor: 'rgba(220, 38, 38, 0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sosOuterRing2: {
    width: 225,
    height: 225,
    borderRadius: 112,
    backgroundColor: 'rgba(220, 38, 38, 0.09)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sosOuterRing1: {
    width: 185,
    height: 185,
    borderRadius: 92,
    backgroundColor: 'rgba(220, 38, 38, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sosMainBtn: {
    width: 148,
    height: 148,
    borderRadius: 74,
    backgroundColor: C.red,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 5,
    borderColor: '#FECDD3',
    ...SHADOWS.glow(C.red),
  },
  sosMainText: {
    color: '#fff',
    fontSize: 38,
    fontWeight: '900',
    letterSpacing: 1,
  },
  sosSubText: {
    color: '#FFE4E6',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginTop: 2,
  },
  sosNotice: {
    color: C.sub,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 14,
    paddingHorizontal: 24,
    lineHeight: 17,
  },

  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 22,
    marginBottom: 12,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '800',
    color: C.sub,
    letterSpacing: 0.8,
  },
  badgePill: {
    backgroundColor: C.cardSubtle,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  badgePillText: {
    fontSize: 11,
    color: C.sub,
    fontWeight: '700',
  },
  typeGrid: {
    gap: 8,
  },
  typeTile: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: C.borderLight,
    borderLeftWidth: 4,
    ...SHADOWS.sm,
  },
  typeIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  typeTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  typeDesc: {
    fontSize: 12,
    color: C.sub,
    marginTop: 1,
  },
  arrowCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },

  hotlineCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.forestBg,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: C.forestBorder,
    marginTop: 20,
    ...SHADOWS.sm,
  },
  hotlineIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1.5,
    borderColor: C.gold,
  },
  hotlineTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: C.forest,
  },
  hotlineDesc: {
    fontSize: 12,
    color: C.sub,
    marginTop: 2,
  },
  hotlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.gold,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    ...SHADOWS.sm,
  },
  hotlineBtnText: {
    color: '#0E2012',
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 0.5,
  },

  historyCard: {
    marginBottom: 8,
    padding: 12,
  },
  historyIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  historyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: C.text,
  },
  historyTime: {
    fontSize: 12,
    color: C.sub,
    marginTop: 2,
  },

  activeContainer: {
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
    marginBottom: 16,
    ...SHADOWS.md,
  },
  activeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  activePulseBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activeBlinkDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
    marginRight: 8,
  },
  activeStatusTitle: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 0.8,
  },
  activeTimer: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    fontWeight: '600',
  },
  activeBody: {
    padding: 18,
  },
  activeCategoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  activeIconCircle: {
    width: 54,
    height: 54,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  activeCategoryTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: C.text,
  },
  activeReportId: {
    fontSize: 12,
    color: C.sub,
    fontWeight: '600',
    marginTop: 2,
  },

  responderBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.blueBg,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: C.blueBorder,
    marginBottom: 14,
  },
  responderLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: C.blue,
    letterSpacing: 0.5,
  },
  responderName: {
    fontSize: 15,
    fontWeight: '800',
    color: C.text,
    marginTop: 1,
  },
  responderSub: {
    fontSize: 12,
    color: C.sub,
  },

  waitingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.amberBg,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: C.amberBorder,
    marginBottom: 14,
  },
  waitingTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: C.amberDark,
  },
  waitingSub: {
    fontSize: 12,
    color: C.amber,
  },

  activeLocRow: {
    flexDirection: 'row',
    backgroundColor: C.bg,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  activeLocTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: C.sub,
    letterSpacing: 0.5,
  },
  activeLocText: {
    fontSize: 14,
    fontWeight: '700',
    color: C.text,
    marginTop: 2,
  },
  coordsText: {
    fontSize: 11,
    color: C.muted,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 2,
  },

  noteBox: {
    backgroundColor: C.cardSubtle,
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  noteTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: C.sub,
  },
  noteContent: {
    fontSize: 13,
    color: C.text,
    marginTop: 2,
  },

  advisoryBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.blueBg,
    borderRadius: 10,
    padding: 10,
    marginBottom: 4,
  },
  advisoryText: {
    flex: 1,
    fontSize: 12,
    color: C.blueDark,
    lineHeight: 16,
  },

  // Modal styles
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: TOP,
    paddingBottom: 14,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  closeModalBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.cardSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshHeaderBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.blueBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveHeaderBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: C.blueBg,
  },
  saveHeaderText: {
    color: C.blue,
    fontSize: 14,
    fontWeight: '800',
  },
  modalTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: C.text,
    letterSpacing: 0.5,
  },
  modalSub: {
    fontSize: 11,
    color: C.sub,
    fontWeight: '600',
  },
  inputStepTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: C.sub,
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  modalTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  modalTypeCard: {
    width: '48.5%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 12,
    padding: 10,
  },
  modalTypeIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  modalTypeLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: C.text,
    flex: 1,
  },

  gpsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 14,
  },
  gpsStatusText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
  },
  retryGpsBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: C.cardSubtle,
  },
  retryGpsText: {
    fontSize: 12,
    fontWeight: '700',
    color: C.blue,
  },
  modalHelpText: {
    textAlign: 'center',
    fontSize: 12,
    color: C.sub,
    marginTop: 8,
  },

  // Weather Safety Center Modal Styles
  weatherHudCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1.5,
    marginBottom: 14,
    ...SHADOWS.md,
  },
  weatherHudIcon: {
    width: 60,
    height: 60,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hudTempText: {
    fontSize: 28,
    fontWeight: '900',
    color: C.text,
  },
  hudConditionText: {
    fontSize: 14,
    fontWeight: '800',
    color: C.textSecondary,
    marginTop: 1,
  },
  hudFeelsText: {
    fontSize: 12,
    color: C.sub,
    fontWeight: '600',
  },
  hudRiskBadge: {
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  hudRiskText: {
    fontSize: 13,
    fontWeight: '900',
    marginTop: 3,
  },
  hudRiskSub: {
    fontSize: 9,
    fontWeight: '800',
    color: C.sub,
  },
  sensorGrid: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: C.borderLight,
    paddingTop: 14,
    marginTop: 14,
  },
  sensorTile: {
    flex: 1,
    alignItems: 'center',
  },
  sensorVal: {
    fontSize: 13,
    fontWeight: '800',
    color: C.text,
    marginTop: 4,
  },
  sensorLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: C.sub,
    marginTop: 1,
  },
  threatBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    marginBottom: 18,
  },
  threatTitle: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  threatDesc: {
    fontSize: 13,
    fontWeight: '700',
    color: C.text,
    marginTop: 2,
    lineHeight: 18,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: C.text,
    letterSpacing: 0.8,
  },
  sectionSub: {
    fontSize: 12,
    color: C.sub,
    marginTop: 2,
    marginBottom: 4,
  },
  hazardCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: C.borderLight,
    borderLeftWidth: 4,
    ...SHADOWS.sm,
  },
  hazardCardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: C.text,
    flex: 1,
  },
  probBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  probText: {
    fontSize: 11,
    fontWeight: '800',
  },
  hazardDesc: {
    fontSize: 13,
    color: C.textSecondary,
    marginTop: 6,
    lineHeight: 18,
  },
  warningSignBox: {
    backgroundColor: C.bg,
    borderRadius: 8,
    padding: 8,
    marginTop: 10,
  },
  warningSignLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: C.amberDark,
  },
  warningSignText: {
    fontSize: 12,
    color: C.textSecondary,
    marginTop: 2,
  },
  reportHazardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF1F2',
    borderRadius: 8,
    paddingVertical: 7,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#FECDD3',
  },
  reportHazardBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: C.redDark,
  },
  prepCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: C.borderLight,
  },
  prepIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: C.blueBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  prepStepTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: C.text,
  },
  prepDetail: {
    fontSize: 12,
    color: C.sub,
    marginTop: 2,
    lineHeight: 16,
  },
  gearCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: C.indigoBorder,
    marginTop: 12,
    ...SHADOWS.sm,
  },
  gearTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: C.indigo,
    letterSpacing: 0.6,
  },
  gearItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  gearItemText: {
    fontSize: 13,
    color: C.text,
    fontWeight: '600',
  },
  qaTopicRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
    marginBottom: 12,
  },
  qaTopicChip: {
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: C.border,
  },
  qaTopicChipActive: {
    backgroundColor: C.blue,
    borderColor: C.blue,
  },
  qaTopicText: {
    fontSize: 12,
    fontWeight: '700',
    color: C.textSecondary,
  },
  qaTopicTextActive: {
    color: '#fff',
  },
  adviceCard: {
    backgroundColor: C.blueBg,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: C.blueBorder,
  },
  adviceTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: C.blueDark,
  },
  adviceStepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 5,
  },
  stepNumberBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: C.blue,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 1,
  },
  stepNumberText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '900',
  },
  adviceStepText: {
    flex: 1,
    fontSize: 13,
    color: C.text,
    lineHeight: 18,
    fontWeight: '600',
  },

  // Profile Dashboard Styles
  avatarCard: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: C.borderLight,
    marginBottom: 20,
    ...SHADOWS.sm,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: C.gold,
    borderWidth: 2.5,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.sm,
  },
  uploadPhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.indigoBg,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.indigoBorder,
    marginBottom: 12,
  },
  uploadPhotoText: {
    color: C.indigo,
    fontSize: 13,
    fontWeight: '700',
  },
  verifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.greenBg,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  verifiedText: {
    color: C.greenDark,
    fontSize: 11,
    fontWeight: '700',
  },
  profileSectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: C.sub,
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: C.borderLight,
    marginBottom: 12,
    ...SHADOWS.sm,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: C.sub,
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '700',
    color: C.text,
    marginTop: 1,
  },
  campusBoundaryCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
    marginTop: 10,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: C.borderLight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...SHADOWS.sm,
  },
  boundaryIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  boundaryTitleText: {
    fontSize: 11,
    fontWeight: '900',
    color: C.text,
    letterSpacing: 0.5,
  },
  boundarySubText: {
    fontSize: 11,
    color: C.sub,
    marginTop: 1,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginLeft: 6,
  },
  demoToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  demoToggleBtnActive: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
  },
  demoToggleText: {
    fontSize: 10,
    fontWeight: '700',
    color: C.sub,
  },
  demoToggleTextActive: {
    color: C.green,
  },
  geofencePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8,
    marginBottom: 10,
  },
  geofencePillText: {
    fontSize: 11,
    fontWeight: '700',
    flex: 1,
  },
});
