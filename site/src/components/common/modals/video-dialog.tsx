"use client";

import Modal from "react-bootstrap/Modal";
import { usePathname } from "next/navigation";
import { getLocaleFromPathname } from "@/lib/locale-path";

interface VideoModalProps {
  isVideoOpen: boolean;
  setIsVideoOpen: (open: boolean) => void;
  videoId?: string;
}

/** Plays the legacy YouTube video in the existing accessible Bootstrap dialog.
 * Unmounting the iframe on close stops playback; only video identifiers are accepted.
 */
export default function VideoModal({ isVideoOpen, setIsVideoOpen, videoId = "PO_fBTkoznc" }: VideoModalProps) {
  const isFa = getLocaleFromPathname(usePathname()) === "fa";
  const validId = /^[\w-]{11}$/.test(videoId);
  return (
    <Modal show={isVideoOpen} onHide={() => setIsVideoOpen(false)} centered size="lg" aria-labelledby="video-dialog-title">
      <Modal.Header closeButton closeLabel={isFa ? "بستن" : "Close"}>
        <Modal.Title id="video-dialog-title">{isFa ? "پخش ویدیو" : "Play video"}</Modal.Title>
      </Modal.Header>
      <Modal.Body className="p-0">
        {isVideoOpen && validId ? <div className="ratio ratio-16x9">
          <iframe src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1`} title={isFa ? "ویدیوی معرفی" : "Introduction video"}
            allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
        </div> : null}
      </Modal.Body>
    </Modal>
  );
}
