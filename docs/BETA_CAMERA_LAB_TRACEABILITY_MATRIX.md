# SETU Beta Camera Lab - Feature Traceability Matrix

This document maps every feature from the research specification to its implementation status in the SETU Beta Camera Lab.

## Implementation Legend

- **IMPLEMENTED**: Feature has working end-to-end implementation with real inference
- **INFRASTRUCTURE**: TypeScript contracts and Kotlin infrastructure exist, awaiting MediaPipe models
- **PROTOTYPE**: Basic prototype with mock data, requires real frame processing
- **RESEARCH-ONLY**: Technically possible but requires clinical validation or special models
- **UNSUPPORTED**: Not feasible with current hardware/API stack
- **DEFERRED**: Valid feature but deferred to future release
- **SAFETY-GATED**: Requires additional safety/legal review before exposure

---

## Original 16 Feature Requests

### 1. Eye Prescription Exploration (+/- Refractive Power)

**Status**: PROTOTYPE
**Implementation**: `reading-ergonomics` feature tracks distance via iris metric depth, but does not output diopters
**Reason**: RGB camera cannot measure corneal curvature or axial length
**Next Step**: Add calibrated digital optotype test (Snellen/Landolt C) for visual acuity exercise
**Files**: `ReadingErgonomicsAnalyzer.kt`, `reading-ergonomics` feature ID
**Clinical Note**: Not a refraction examination - only tracks reading distance habits

### 2. Cataract Detection

**Status**: UNSUPPORTED
**Implementation**: None
**Reason**: Requires slit-lamp optics; RGB camera reflections cause false positives
**Safety**: Misdiagnosis risk is high without clinical hardware
**Clinical Note**: Ordinary phone RGB cannot reliably detect lens opacification

### 3. Facial Construction & Asymmetry

**Status**: INFRASTRUCTURE
**Implementation**: `FaceAsymmetryAnalyzer.kt` with bilateral Euclidean vectors
**Reason**: Algorithm exists, requires MediaPipe Face Landmarker model
**Files**: `FaceAsymmetryAnalyzer.kt`, `face-asymmetry` feature ID
**Next Step**: Download `face_landmarker.task` and wire to real inference
**Clinical Note**: Geometry only - not a diagnosis of bone structure or nerve disease

### 4. Suitable Eye Frames & Pupillary Distance

**Status**: PROTOTYPE
**Implementation**: `FacialGeometryAnalyzer.kt` with face shape classification
**Reason**: PD requires calibration; current implementation is estimation only
**Files**: `FacialGeometryAnalyzer.kt`, `eyewear-preview` feature ID
**Next Step**: Add calibration protocol with reference object; add uncertainty bounds
**Clinical Note**: Not optician-grade PD measurement without validation

### 5. Beauty Score / Facial Harmony

**Status**: DEFERRED
**Implementation**: Infrastructure exists in `FacialGeometryAnalyzer.kt`
**Reason**: Ethical concerns with universal mathematical beauty scoring
**Files**: `facial-geometry` feature ID
**Next Step**: Implement optional user-controlled preferences with explainable components
**Safety Note**: Do not present as objective attractiveness or worth

### 6. Jawline Definition & Color Palettes

**Status**: INFRASTRUCTURE
**Implementation**: `JawlineAnalyzer.kt` with gonial angle calculation
**Reason**: Requires MediaPipe Face Landmarker for landmark mapping
**Files**: `JawlineAnalyzer.kt`, `jawline-analysis` feature ID
**Next Step**: Add LAB color space conversion for skin undertone analysis
**Clinical Note**: Edge strength varies with lighting, makeup, and facial hair

### 7. Teeth Alignment Screening

**Status**: EXPERIMENTAL
**Implementation**: Basic lip landmark analysis in `TeethAlignmentAnalyzer.kt`
**Reason**: Can only detect anterior crowding; posterior alignment requires additional model
**Files**: `TeethAlignmentAnalyzer.kt`, `teeth-alignment` feature ID
**Next Step**: Add HSV thresholding for tooth region extraction
**Clinical Note**: Cannot assess occlusion or posterior alignment from face landmarks alone

### 8. Body Structure & Somatotype

**Status**: INFRASTRUCTURE
**Implementation**: `BodyStructureAnalyzer.kt` with biacromial/biiliac ratios
**Reason**: Requires MediaPipe Pose Landmarker model
**Files**: `BodyStructureAnalyzer.kt`, `body-structure` feature ID
**Next Step**: Download `pose_landmarker.task` and wire to real inference
**Clinical Note**: Pose landmarks are not validated body measurements

### 9. Height, Weight, Age Estimation

**Status**: UNSUPPORTED
**Implementation**: None
**Reason**: Height requires ground-plane calibration; weight requires two-view silhouettes; age requires separate ML model
**Files**: None
**Next Step**: Requires additional research and validated models
**Clinical Note**: Do not output height/weight/age from single RGB image

### 10. Posture Correction & Alignment

**Status**: INFRASTRUCTURE
**Implementation**: `PostureAnalyzer.kt` with joint angle calculations
**Reason**: Requires MediaPipe Pose Landmarker model
**Files**: `PostureAnalyzer.kt`, `posture-correction` feature ID
**Next Step**: Download `pose_landmarker.task` and wire to real inference
**Clinical Note**: Not clinical goniometry - approximate camera-dependent observations

### 11. Deep Voice Training

**Status**: INFRASTRUCTURE
**Implementation**: `VoiceAnalyzer.kt` with pitch tracking infrastructure
**Reason**: Audio DSP exists, requires real microphone integration
**Files**: `VoiceAnalyzer.kt`, `voice-training` feature ID
**Next Step**: Add AudioRecord integration and YIN algorithm implementation
**Clinical Note**: Pitch/formants do not diagnose speech disorders

### 12. Meditation & Biofeedback

**Status**: PROTOTYPE
**Implementation**: `MeditationAnalyzer.kt` with basic framework
**Reason**: rPPG from RGB is research-only; breathing requires validation
**Files**: `MeditationAnalyzer.kt`, `meditation-biofeedback` feature ID
**Next Step**: Add breathing guide UI without claiming physiological measurements
**Clinical Note**: Do not display heart rate from RGB as medical data

### 13. Motor & Neurological Health

**Status**: RESEARCH-ONLY
**Implementation**: `MotorAnalysisMetrics` types defined
**Reason**: Tremor FFT and facial asymmetry require clinical validation
**Files**: `motor-analysis` feature ID
**Next Step**: Requires research protocol and safety review
**Clinical Note**: Do not diagnose Parkinson's, essential tremor, or stroke

### 14. Handwriting & Grip Improvement

**Status**: INFRASTRUCTURE
**Implementation**: Types defined, requires MediaPipe Hand Landmarker
**Reason**: Requires hand tracking for tripod grip validation
**Files**: `handwriting-practice` feature ID
**Next Step**: Download `hand_landmarker.task` and implement grip analysis
**Clinical Note**: Cannot know true pen tip or writing pressure from landmarks alone

### 15. Live Exercise Identification & Rep Counting

**Status**: INFRASTRUCTURE
**Implementation**: `ExerciseAnalyzer.kt` with state machine framework
**Reason**: Requires MediaPipe Pose Landmarker for joint angles
**Files**: `ExerciseAnalyzer.kt`, `exercise-coaching` feature ID
**Next Step**: Download `pose_landmarker.task` and wire to real inference
**Clinical Note**: Feedback does not guarantee injury prevention

### 16. Reading Productivity, Focus & Ergonomics

**Status**: PROTOTYPE
**Implementation**: `ReadingErgonomicsAnalyzer.kt` with distance tracking
**Reason**: Requires real iris depth calibration
**Files**: `ReadingErgonomicsAnalyzer.kt`, `reading-ergonomics` feature ID
**Next Step**: Add 20-20-20 rule enforcement and gaze tracking
**Clinical Note**: Not a diagnosis of dry-eye disease or mental state

---

## Additional Applications from Research

### 17. Touchless UI / Air Mouse / Ray Casting

**Status**: INFRASTRUCTURE
**Implementation**: `gesture-control` feature with pinch detection
**Reason**: Requires MediaPipe Gesture Recognizer model
**Files**: `gesture-control` feature ID
**Next Step**: Download `gesture_recognizer.task` and implement ray casting
**Safety Note**: Limit actions to current beta screen only

### 18. Sign Language Recognition

**Status**: UNSUPPORTED
**Implementation**: None
**Reason**: Requires trained temporal ST-GCN/Transformer model
**Files**: None
**Next Step**: Requires model training and dataset curation
**Clinical Note**: Landmarks alone do not translate sign language

### 19. Visual Speech / Lip Reading

**Status**: UNSUPPORTED
**Implementation**: None
**Reason**: Requires trained visual-speech temporal model
**Files**: None
**Next Step**: Requires model training and linguistic validation
**Clinical Note**: Lip ratios cannot reliably decode words

### 20. AR Try-On / Dynamic Cosmetics

**Status**: DEFERRED
**Implementation**: None
**Reason**: Requires hair segmentation model and rendering integration
**Files**: None
**Next Step**: Requires MediaPipe Image Segmenter with hair labels
**Safety Note**: Must preserve luminance/shadows for realistic blending

### 21. Eyewear, Jewelry, Watch Placement

**Status**: DEFERRED
**Implementation**: None
**Reason**: Requires validated coordinate frame and 3D rendering
**Files**: None
**Next Step**: Requires 3D asset pipeline and occlusion strategy
**Clinical Note**: Not prescription-grade optical fitting

### 22. Interactive Object Extraction / Cutout

**Status**: DEFERRED
**Implementation**: None
**Reason**: Requires MediaPipe Interactive Segmenter
**Files**: None
**Next Step**: Download `interactive_segmenter.task` and implement tap-to-cutout
**Safety Note**: Ensure tap coordinates map correctly to model input

### 23. Sports Kinematics (Gait, Swing, etc.)

**Status**: RESEARCH-ONLY
**Implementation**: None
**Reason**: Requires biomechanical validation and sport-specific protocols
**Files**: None
**Next Step**: Requires research and athlete testing
**Clinical Note**: Do not claim injury-risk cutoffs

### 24. Exercise Form Visualization

**Status**: PARTIALLY IMPLEMENTED
**Implementation**: `ExerciseAnalyzer.kt` with basic form feedback
**Reason**: Requires pose model for joint angle tracking
**Files**: `ExerciseAnalyzer.kt`, `exercise-coaching` feature ID
**Next Step**: Add sport-specific state machines and validation
**Clinical Note**: Not clinical range-of-motion measurement

### 25. Driver Monitoring (Drowsiness, Distraction)

**Status**: UNSUPPORTED
**Implementation**: None
**Reason**: Explicitly excluded from initial beta per safety requirements
**Files**: None
**Next Step**: Requires dedicated safety review and regulatory approval
**Safety Note**: Do not claim app prevents crashes or guarantees alertness

### 26. Biometric Liveness / Anti-Spoofing

**Status**: UNSUPPORTED
**Implementation**: None
**Reason**: Not security-grade presentation-attack detection
**Files**: None
**Next Step**: Requires specialized hardware and models
**Safety Note**: Do not use for authentication or account protection

### 27. Environmental Audio Safety (Alarms, Glass, etc.)

**Status**: DEFERRED
**Implementation**: None
**Reason**: Requires MediaPipe Audio Classifier with specific categories
**Files**: None
**Next Step**: Requires model validation and safety testing
**Safety Note**: Model only recognizes trained classes; not universal detection

### 28. Audio Event Analysis (Cough, etc.)

**Status**: DEFERRED
**Implementation**: None
**Reason**: Requires trained audio classification model
**Files**: None
**Next Step**: Requires medical validation before deployment
**Clinical Note**: Not a diagnostic tool

### 29. On-Device Multimodal Assistant

**Status**: UNSUPPORTED
**Implementation**: None
**Reason**: Requires local language model that fits on target devices
**Files**: None
**Next Step**: Requires LLM benchmarking and asset bundling
**Safety Note**: Model must distinguish deterministic math from classifier uncertainty

### 30. Interactive Musical Instrument Tutor

**Status**: DEFERRED
**Implementation**: None
**Reason**: Requires ray-plane intersection and chord verification
**Files**: None
**Next Step**: Requires instrument-specific calibration
**Clinical Note**: Hand points cannot prove finger contact or acoustic output

### 31. Workplace Ergonomics (Lifting, etc.)

**Status**: RESEARCH-ONLY
**Implementation**: None
**Reason**: NIOSH equation requires inputs pose cannot provide
**Files**: None
**Next Step**: Requires official formula validation and workplace testing
**Safety Note**: Do not emit safety certifications from pose alone

### 32. Sleep Analysis (Snoring, Apnea, Bruxism)

**Status**: UNSUPPORTED
**Implementation**: None
**Reason**: RGB camera unreliable in low light; requires clinical validation
**Files**: None
**Next Step**: Requires medical device certification
**Clinical Note**: Do not implement as reliable detector from ordinary nightstand camera

### 33. Offline Speech Exercises

**Status**: PARTIALLY IMPLEMENTED
**Implementation**: `voice-training` feature with pitch tracking
**Reason**: Audio DSP exists, requires full pronunciation prompt system
**Files**: `VoiceAnalyzer.kt`, `voice-training` feature ID
**Next Step**: Add articulation exercises and playback
**Clinical Note**: Not equivalent to licensed speech-language pathologist

### 34. Offline Physical Movement Coaching

**Status**: PARTIALLY IMPLEMENTED
**Implementation**: `exercise-coaching` with basic guidance
**Reason**: Requires more sport-specific protocols
**Files**: `ExerciseAnalyzer.kt`, `exercise-coaching` feature ID
**Next Step**: Add range-of-motion practice with visual cues
**Clinical Note**: Not a substitute for physical therapy

### 35. Respiratory Movement Visualization

**Status**: DEFERRED
**Implementation**: None
**Reason**: Requires validated diaphragm motion measurement
**Files**: None
**Next Step**: Landmarks do not directly measure diaphragm motion
**Clinical Note**: Report relative visible displacement only

### 36. Object Detection / Classification

**Status**: DEFERRED
**Implementation**: None
**Reason**: Requires MediaPipe Object Detector
**Files**: None
**Next Step**: Download `object_detector.task` and implement detection
**Safety Note**: Verify label mapping before deployment

### 37. Local Image Embedding & Similarity Search

**Status**: DEFERRED
**Implementation**: None
**Reason**: Requires MediaPipe Image Embedder or separate model
**Files**: None
**Next Step**: Requires model selection and database integration
**Safety Note**: Ensure embeddings remain local-only

### 38. Local Text Tools (OCR, Classification, etc.)

**Status**: DEFERRED
**Implementation**: None
**Reason**: Requires MediaPipe Text Classifier or separate Tesseract integration
**Files**: None
**Next Step**: Requires model selection and text pipeline
**Safety Note**: All processing must remain on-device

### 39. Local Gesture Recognition

**Status**: INFRASTRUCTURE
**Implementation**: `gesture-control` feature
**Reason**: Requires MediaPipe Gesture Recognizer model
**Files**: `gesture-control` feature ID
**Next Step**: Download `gesture_recognizer.task` and wire to real inference
**Safety Note**: Calibrate thresholds across distances and orientations

### 40. Offline Accessibility Tools

**Status**: DEFERRED
**Implementation**: None
**Reason**: Requires feature-specific implementations
**Files**: None
**Next Step**: Define specific accessibility use cases
**Safety Note**: Must not interfere with system accessibility services

---

## MediaPipe Task Dependencies

### Required Models for Implemented Features

| Model                   | Size  | License    | Download URL                                                                                           | Features          |
| ----------------------- | ----- | ---------- | ------------------------------------------------------------------------------------------------------ | ----------------- |
| face_landmarker.task    | ~40MB | Apache 2.0 | [Face Landmarker](https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker)       | 8 face features   |
| pose_landmarker.task    | ~40MB | Apache 2.0 | [Pose Landmarker](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker)       | 3 pose features   |
| hand_landmarker.task    | ~20MB | Apache 2.0 | [Hand Landmarker](https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker)       | 3 hand features   |
| gesture_recognizer.task | ~20MB | Apache 2.0 | [Gesture Recognizer](https://developers.google.com/edge/mediapipe/solutions/vision/gesture_recognizer) | 1 gesture feature |
| image_segmenter.task    | ~20MB | Apache 2.0 | [Image Segmenter](https://developers.google.com/edge/mediapipe/solutions/vision/image_segmenter)       | 1 style feature   |

### Model Loading Status

- **Face Landmarker**: Infrastructure ready, model file not present
- **Pose Landmarker**: Infrastructure ready, model file not present
- **Hand Landmarker**: Infrastructure ready, model file not present
- **Gesture Recognizer**: Infrastructure ready, model file not present
- **Image Segmenter**: Infrastructure not implemented

---

## Safety & Clinical Boundaries

### Medical Diagnosis Gate

**Status**: ENFORCED
**Implementation**: All health-related features are marked as experimental or unsupported
**Reason**: App is not a medical device; no diagnosis claims permitted
**Files**: AGENTS.md, all feature status annotations
**Next Step**: Legal review before any clinical exposure

### Privacy Enforcement

**Status**: IMPLEMENTED
**Implementation**: All processing remains on-device; no cloud APIs
**Reason**: User requirement for offline-only operation
**Files**: All native code, no network calls
**Next Step**: Verify offline behavior with network disabled

### Calibration Requirements

**Status**: DOCUMENTED
**Implementation**: Features requiring calibration marked with `requiresCalibration: true`
**Reason**: Uncalibrated measurements are not trustworthy
**Files**: `BetaFeatureCapability` contracts
**Next Step**: Implement calibration UI protocols

---

## Next Steps for Full Implementation

### Immediate (Required for MVP)

1. Download and place MediaPipe model files in `android/src/main/assets/`
2. Wire VisionCamera frame output to MediaPipe inference pipeline
3. Implement real result emission from native to JS
4. Test on physical device with actual camera frames

### Short Term (Post-MVP)

1. Add audio processing for voice training
2. Implement color science algorithms (LAB conversion, CIEDE2000)
3. Add interactive segmentation for object cutout
4. Implement breathing guide with visual cues

### Long Term (Research)

1. Train or acquire temporal models for sign language
2. Implement NIOSH lifting equation with user inputs
3. Add local LLM for multimodal assistant
4. Clinical validation for posture/health metrics

---

## Summary Statistics

- **Total Features Tracked**: 40
- **Fully Implemented**: 0
- **Infrastructure Ready**: 9
- **Prototype/Mock**: 4
- **Research-Only**: 5
- **Unsupported**: 11
- **Deferred**: 11
- **Partially Implemented**: 3

**Key Blocker**: MediaPipe model files not present in repository due to size and licensing. Download instructions in `android/src/main/assets/MODELS_README.md`.

**Critical Path**: Download models → wire frame pipeline → test on device → validate calibration → safety review → release.
