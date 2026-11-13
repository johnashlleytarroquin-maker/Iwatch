import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { C, SHADOWS } from './theme';

export const TOP = Platform.OS === 'android' ? (StatusBar.currentHeight || 28) + 8 : 52;

// Reusable Vibrant Avatar Component with image support and colored initials fallback
export function Avatar({ uri, name, size = 'md', color, style, onPress }) {
  const dims = {
    sm: 34,
    md: 46,
    lg: 68,
    xl: 96,
  }[size] || 46;

  const fontSizes = {
    sm: 13,
    md: 17,
    lg: 24,
    xl: 36,
  }[size] || 17;

  const initials = (name || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');

  const Wrap = onPress ? TouchableOpacity : View;

  return (
    <Wrap
      activeOpacity={0.8}
      onPress={onPress}
      style={[
        {
          width: dims,
          height: dims,
          borderRadius: dims / 2,
          overflow: 'hidden',
          backgroundColor: color || C.forest,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 2,
          borderColor: '#fff',
          ...SHADOWS.sm,
        },
        style,
      ]}
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: dims, height: dims, borderRadius: dims / 2 }}
          resizeMode="cover"
        />
      ) : (
        <Text style={{ color: '#fff', fontSize: fontSizes, fontWeight: '800' }}>
          {initials}
        </Text>
      )}
    </Wrap>
  );
}

// Render type-specific vector icon
export function TypeIcon({ typeKey, size = 20, color, style }) {
  switch (typeKey) {
    case 'medical':
      return <Ionicons name="medical" size={size} color={color || '#EF4444'} style={style} />;
    case 'fire':
      return <Ionicons name="flame" size={size} color={color || '#F97316'} style={style} />;
    case 'fight':
      return <MaterialCommunityIcons name="shield-alert" size={size} color={color || '#DC2626'} style={style} />;
    case 'accident':
      return <Feather name="alert-triangle" size={size} color={color || '#D97706'} style={style} />;
    case 'harassment':
      return <Ionicons name="hand-left" size={size} color={color || '#7C3AED'} style={style} />;
    default:
      return <Ionicons name="alert-circle" size={size} color={color || C.sub} style={style} />;
  }
}

export function Btn({
  title,
  onPress,
  color = C.blue,
  disabled,
  loading,
  outline,
  small,
  icon,
  iconRight,
  style,
  textStyle,
}) {
  const off = disabled || loading;
  const isOutline = outline;
  return (
    <TouchableOpacity
      activeOpacity={0.78}
      onPress={onPress}
      disabled={off}
      style={[
        s.btn,
        small && s.btnSmall,
        isOutline
          ? { borderColor: color, borderWidth: 1.5, backgroundColor: 'transparent' }
          : { backgroundColor: color, ...SHADOWS.sm },
        off && { opacity: 0.5 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={isOutline ? color : '#fff'} />
      ) : (
        <View style={s.btnInner}>
          {icon ? <View style={s.btnIconLeft}>{icon}</View> : null}
          <Text
            style={[
              s.btnText,
              small && s.btnTextSmall,
              isOutline && { color },
              !isOutline && (color === C.gold || color === C.amber || color === '#FABC11') && { color: '#0E2012', fontWeight: '900' },
              textStyle,
            ]}
          >
            {title}
          </Text>
          {iconRight ? <View style={s.btnIconRight}>{iconRight}</View> : null}
        </View>
      )}
    </TouchableOpacity>
  );
}

export const Field = React.forwardRef(function Field(
  {
    label,
    style,
    inputStyle,
    helper,
    error,
    secureTextEntry,
    icon,
    inputRef,
    ...props
  },
  ref
) {
  const [showPassword, setShowPassword] = useState(false);
  const resolvedRef = ref || inputRef;

  return (
    <View style={s.fieldWrapper}>
      {label ? <Text style={s.label}>{label}</Text> : null}
      <View style={[s.inputBox, error && s.inputBoxError]}>
        <TextInput
          ref={resolvedRef}
          placeholderTextColor={C.muted}
          secureTextEntry={Boolean(secureTextEntry && !showPassword)}
          style={[s.input, style, inputStyle]}
          {...props}
        />
        {secureTextEntry ? (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setShowPassword((prev) => !prev)}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={s.eyeButton}
          >
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={showPassword ? C.blue : C.sub}
            />
          </TouchableOpacity>
        ) : null}
      </View>
      {error ? (
        <Text style={s.errorText}>{error}</Text>
      ) : helper ? (
        <Text style={s.helperText}>{helper}</Text>
      ) : null}
    </View>
  );
});

export function Badge({ text, color = C.blue, bg, withDot = true, size = 'md' }) {
  const isSmall = size === 'sm';
  return (
    <View
      style={[
        s.badge,
        isSmall && { paddingVertical: 2, paddingHorizontal: 7 },
        { backgroundColor: bg || color + '15', borderColor: color + '30', borderWidth: 1 },
      ]}
    >
      {withDot ? <View style={[s.badgeDot, { backgroundColor: color }]} /> : null}
      <Text style={[s.badgeText, isSmall && { fontSize: 10 }, { color }]}>{text}</Text>
    </View>
  );
}

export function Card({ children, style, onPress, noPadding }) {
  const Wrap = onPress ? TouchableOpacity : View;
  return (
    <Wrap
      activeOpacity={0.85}
      onPress={onPress}
      style={[s.card, noPadding && { padding: 0 }, SHADOWS.sm, style]}
    >
      {children}
    </Wrap>
  );
}

export function Chip({ label, icon, selected, onPress, color = C.blue }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[
        s.chip,
        selected
          ? { backgroundColor: color, borderColor: color, ...SHADOWS.sm }
          : { backgroundColor: '#fff', borderColor: C.border },
      ]}
    >
      {icon ? <View style={{ marginRight: 6 }}>{icon}</View> : null}
      <Text
        style={[
          s.chipText,
          selected ? { color: '#fff', fontWeight: '700' } : { color: C.textSecondary },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export function Header({ title, subtitle, right, backAction }) {
  return (
    <View style={s.header}>
      <View style={s.headerRow}>
        {backAction ? (
          <TouchableOpacity
            onPress={backAction}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={s.backBtn}
          >
            <Ionicons name="arrow-back" size={22} color={C.text} />
          </TouchableOpacity>
        ) : null}
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={s.headerSub} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {right ? <View style={s.headerRight}>{right}</View> : null}
      </View>
    </View>
  );
}

export function TabBar({ tabs, active, onChange }) {
  const getTabIcon = (key, on) => {
    switch (key) {
      case 'live':
        return <Ionicons name={on ? 'warning' : 'warning-outline'} size={22} color={on ? C.red : C.muted} />;
      case 'history':
        return <Ionicons name={on ? 'archive' : 'archive-outline'} size={22} color={on ? C.blue : C.muted} />;
      case 'overview':
        return <Ionicons name={on ? 'grid' : 'grid-outline'} size={22} color={on ? C.blue : C.muted} />;
      case 'approvals':
        return <Ionicons name={on ? 'shield-checkmark' : 'shield-checkmark-outline'} size={22} color={on ? C.blue : C.muted} />;
      case 'accounts':
        return <Ionicons name={on ? 'people' : 'people-outline'} size={22} color={on ? C.blue : C.muted} />;
      default:
        return <Ionicons name="apps-outline" size={22} color={on ? C.blue : C.muted} />;
    }
  };

  return (
    <View style={s.tabBarContainer}>
      <View style={s.tabBar}>
        {tabs.map((t) => {
          const on = t.key === active;
          const activeColor = t.key === 'live' ? C.red : C.blue;
          return (
            <TouchableOpacity
              key={t.key}
              style={s.tab}
              onPress={() => onChange(t.key)}
              activeOpacity={0.7}
            >
              <View style={[s.tabIconWrapper, on && { backgroundColor: activeColor + '12' }]}>
                {getTabIcon(t.key, on)}
                {t.badge ? (
                  <View style={[s.tabBadge, { backgroundColor: t.key === 'live' ? C.red : C.gold }]}>
                    <Text
                      style={[
                        s.tabBadgeText,
                        t.key !== 'live' && { color: '#0E2012', fontWeight: '900' },
                      ]}
                    >
                      {t.badge > 99 ? '99+' : t.badge}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text
                style={[
                  s.tabLabel,
                  on ? { color: activeColor, fontWeight: '700' } : { color: C.muted },
                ]}
              >
                {t.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export function Empty({ icon = 'file-tray-outline', text, subtext }) {
  return (
    <View style={s.emptyContainer}>
      <View style={s.emptyIconCircle}>
        <Ionicons name={icon} size={36} color={C.muted} />
      </View>
      <Text style={s.emptyTitle}>{text}</Text>
      {subtext ? <Text style={s.emptySub}>{subtext}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  btn: {
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  btnSmall: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 10,
    minHeight: 36,
  },
  btnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnIconLeft: {
    marginRight: 8,
  },
  btnIconRight: {
    marginLeft: 8,
  },
  btnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  btnTextSmall: {
    fontSize: 13,
  },

  fieldWrapper: {
    marginBottom: 14,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: C.textSecondary,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 12,
  },
  inputBoxError: {
    borderColor: C.red,
  },
  input: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: C.text,
    minHeight: 48,
  },
  eyeButton: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  helperText: {
    fontSize: 12,
    color: C.sub,
    marginTop: 4,
  },
  errorText: {
    fontSize: 12,
    color: C.red,
    fontWeight: '600',
    marginTop: 4,
  },

  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  card: {
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: C.borderLight,
  },

  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },

  header: {
    paddingTop: TOP,
    paddingBottom: 14,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: C.text,
    letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: 12,
    fontWeight: '600',
    color: C.sub,
    marginTop: 1,
  },
  headerRight: {
    marginLeft: 12,
  },

  tabBarContainer: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    paddingTop: 8,
  },
  tabBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIconWrapper: {
    width: 44,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: 2,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1,
  },
  tabBadge: {
    position: 'absolute',
    top: -2,
    right: 2,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  tabBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '900',
  },

  emptyContainer: {
    padding: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: C.cardSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    color: C.text,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptySub: {
    color: C.sub,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 240,
  },
});
