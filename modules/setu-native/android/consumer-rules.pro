# Release builds drop verbose/debug/info logging from the Setu module. Warnings and errors stay.
# Nothing else is kept explicitly: Expo modules are referenced by the generated package list, the
# service/receiver components by the merged manifest, and the module uses no reflection.
-assumenosideeffects class android.util.Log {
    public static int v(...);
    public static int d(...);
    public static int i(...);
}
