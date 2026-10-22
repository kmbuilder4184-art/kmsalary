"use client";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
export function Modal({ open, title, children, onClose, className }) {
    useEffect(() => {
      if (!open) return undefined;

      const scrollY = window.scrollY;
      const body = document.body;
      const html = document.documentElement;
      const previousStyles = {
        bodyPosition: body.style.position,
        bodyTop: body.style.top,
        bodyLeft: body.style.left,
        bodyRight: body.style.right,
        bodyWidth: body.style.width,
        bodyOverflow: body.style.overflow,
        bodyPaddingRight: body.style.paddingRight,
        htmlOverflow: html.style.overflow,
      };
      const scrollbarWidth = window.innerWidth - html.clientWidth;

      body.style.position = "fixed";
      body.style.top = `-${scrollY}px`;
      body.style.left = "0";
      body.style.right = "0";
      body.style.width = "100%";
      body.style.overflow = "hidden";
      html.style.overflow = "hidden";
      if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`;

      return () => {
        body.style.position = previousStyles.bodyPosition;
        body.style.top = previousStyles.bodyTop;
        body.style.left = previousStyles.bodyLeft;
        body.style.right = previousStyles.bodyRight;
        body.style.width = previousStyles.bodyWidth;
        body.style.overflow = previousStyles.bodyOverflow;
        body.style.paddingRight = previousStyles.bodyPaddingRight;
        html.style.overflow = previousStyles.htmlOverflow;
        window.scrollTo(0, scrollY);
      };
    }, [open]);

    if (!open || typeof document === "undefined") return null;

    return createPortal((<div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-950/45 p-4 backdrop-blur-md">
      <div className={cn("glass-card my-auto max-h-[92vh] w-full max-w-3xl shrink-0 overflow-hidden rounded-xl", className)}>
        <div className="flex items-center justify-between border-b border-white/45 px-5 py-4 dark:border-white/10">
          <h2 className="text-base font-semibold">{title}</h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close modal">
            <X className="h-4 w-4"/>
          </Button>
        </div>
        <div className="max-h-[calc(92vh-4rem)] overflow-y-auto p-5">{children}</div>
      </div>
    </div>), document.body);
}
