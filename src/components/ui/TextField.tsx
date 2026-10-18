import React, { useState } from 'react';
import {
  StyleProp,
  StyleSheet,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { useTheme } from '@/theme/useTheme';
import { AppText } from './AppText';
import { SquircleSurface } from './SquircleSurface';

export interface TextFieldProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export function TextField({
  label,
  error,
  containerStyle,
  inputStyle,
  leftIcon,
  rightIcon,
  ...rest
}: TextFieldProps) {
  const { colors } = useTheme();
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? (
        <AppText variant="caption" style={[styles.label, { color: colors.text.secondary }]}>
          {label}
        </AppText>
      ) : null}
      <SquircleSurface
        radius={14}
        smoothing={1}
        fill={colors.surface}
        stroke={error ? colors.error : isFocused ? colors.primary : colors.border}
        strokeWidth={isFocused || error ? 1.5 : 1}
        style={styles.surface}
      >
        <View style={styles.inputWrapper}>
          {leftIcon}
          <TextInput
            placeholderTextColor={colors.text.muted}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            style={[
              styles.input,
              { color: colors.text.primary },
              inputStyle,
            ]}
            {...rest}
          />
          {rightIcon}
        </View>
      </SquircleSurface>
      {error ? (
        <AppText variant="caption" style={[styles.error, { color: colors.error }]}>
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 6,
  },
  label: {
    marginBottom: 6,
    fontWeight: '500',
  },
  surface: {
    minHeight: 48,
    justifyContent: 'center',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 8,
  },
  input: {
    flex: 1,
    height: 48,
    fontSize: 16,
  },
  error: {
    marginTop: 4,
  },
});
