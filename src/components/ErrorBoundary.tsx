/**
 * Error Boundary Component
 * Catches JavaScript errors in child components
 */

import React, { Component, ErrorInfo, ReactNode } from "react"
import { View, StyleSheet } from "react-native"
import { crashReporter } from "@/services/security/CrashReportingService"
import { AppButton } from "./ui/AppButton"
import { AppText } from "./ui/AppText"
import { Card } from "./ui/Card"
import { ScreenContainer } from "./ui/ScreenContainer"

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo)
    crashReporter.recordCrash(error, {
      componentStack: errorInfo.componentStack,
    })
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <ScreenContainer>
          <View style={styles.container}>
            <Card style={styles.card}>
              <AppText variant="heading" style={styles.title}>
                Something went wrong
              </AppText>
              <AppText variant="body" style={styles.message}>
                An unexpected error occurred. Please try again.
              </AppText>
              {this.state.error && (
                <AppText variant="caption" style={styles.errorText}>
                  {this.state.error.message}
                </AppText>
              )}
              <AppButton title="Try Again" onPress={this.handleReset} style={styles.button} />
            </Card>
          </View>
        </ScreenContainer>
      )
    }

    return this.props.children
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 16,
  },
  card: {
    padding: 24,
  },
  title: {
    marginBottom: 12,
  },
  message: {
    marginBottom: 8,
  },
  errorText: {
    color: "#F44336",
    marginBottom: 16,
    fontStyle: "italic",
  },
  button: {
    marginTop: 8,
  },
})
