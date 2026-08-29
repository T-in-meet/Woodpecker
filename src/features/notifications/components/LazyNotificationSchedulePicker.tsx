"use client";

import dynamic from "next/dynamic";

import type { NotificationSchedulePickerProps } from "./NotificationSchedulePicker";

const importNotificationSchedulePicker = () =>
  import("./NotificationSchedulePicker");

export const LazyNotificationSchedulePicker =
  dynamic<NotificationSchedulePickerProps>(
    () =>
      importNotificationSchedulePicker().then(
        (module) => module.NotificationSchedulePicker,
      ),
    { ssr: false },
  );

export function preloadNotificationSchedulePicker() {
  void importNotificationSchedulePicker();
}
