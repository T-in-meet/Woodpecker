import { Skeleton } from "@/components/ui/skeleton";

const SKELETON_MOTION_CLASS = "motion-reduce:animate-none";

export default function NoteDetailLoading() {
  return (
    <div
      role="status"
      aria-label="저장된 노트를 불러오는 중"
      aria-busy="true"
      className="mx-auto w-full max-w-4xl px-6 py-10 md:px-12"
    >
      <span className="sr-only">저장된 노트를 불러오는 중…</span>
      <div aria-hidden="true">
        <div className="mb-6 flex items-center gap-2">
          <Skeleton className={`h-4 w-8 ${SKELETON_MOTION_CLASS}`} />
          <Skeleton className={`size-3 ${SKELETON_MOTION_CLASS}`} />
          <Skeleton className={`h-4 w-16 ${SKELETON_MOTION_CLASS}`} />
          <Skeleton className={`size-3 ${SKELETON_MOTION_CLASS}`} />
          <Skeleton className={`h-4 w-28 ${SKELETON_MOTION_CLASS}`} />
        </div>

        <div className="border-b border-border/60 pb-6">
          <div className="flex items-center gap-2">
            <Skeleton
              className={`h-6 w-16 rounded-full ${SKELETON_MOTION_CLASS}`}
            />
            <Skeleton className={`h-4 w-48 ${SKELETON_MOTION_CLASS}`} />
          </div>
          <Skeleton
            className={`mt-4 h-10 w-2/3 max-w-xl ${SKELETON_MOTION_CLASS}`}
          />
          <div className="mt-5 flex items-center gap-2">
            <Skeleton className={`h-8 w-28 ${SKELETON_MOTION_CLASS}`} />
            <Skeleton className={`h-8 w-20 ${SKELETON_MOTION_CLASS}`} />
          </div>
        </div>

        <div className="space-y-3 py-6">
          <Skeleton className={`h-4 w-full ${SKELETON_MOTION_CLASS}`} />
          <Skeleton className={`h-4 w-11/12 ${SKELETON_MOTION_CLASS}`} />
          <Skeleton className={`h-4 w-4/5 ${SKELETON_MOTION_CLASS}`} />
        </div>
      </div>
    </div>
  );
}
