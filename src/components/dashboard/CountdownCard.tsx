"use client";

import { useState, useEffect } from "react";
import { Clock } from "lucide-react";
import { memo } from "react";

interface CountdownCardProps {
  relayOpenDate: Date;
  relayCloseDate: Date;
}

export const CountdownCard = memo(function CountdownCard({
  relayOpenDate,
  relayCloseDate,
}: CountdownCardProps) {
  const [timeUntilOpen, setTimeUntilOpen] = useState("");
  const [timeUntilClose, setTimeUntilClose] = useState("");

  useEffect(() => {
    const updateCountdowns = () => {
      const now = new Date();
      
      const openDiff = relayOpenDate.getTime() - now.getTime();
      const closeDiff = relayCloseDate.getTime() - now.getTime();

      if (openDiff > 0) {
        const days = Math.floor(openDiff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((openDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        setTimeUntilOpen(`${days}d ${hours}h`);
      } else {
        setTimeUntilOpen("Relay Open");
      }

      if (closeDiff > 0) {
        const days = Math.floor(closeDiff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((closeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        setTimeUntilClose(`${days}d ${hours}h`);
      } else {
        setTimeUntilClose("Relay Closed");
      }
    };

    updateCountdowns();
    const interval = setInterval(updateCountdowns, 60000);

    return () => clearInterval(interval);
  }, [relayOpenDate, relayCloseDate]);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6" role="region" aria-label="TennoCon countdown">
      <div className="flex items-center gap-3 mb-4">
        <Clock className="w-5 h-5 text-blue-400" aria-hidden="true" />
        <h2 className="text-lg font-semibold text-white">TennoCon Countdown</h2>
      </div>
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-zinc-400 text-sm">Until Relay Opens</span>
          <time className="text-blue-400 font-mono font-bold text-lg" dateTime={relayOpenDate.toISOString()}>
            {timeUntilOpen}
          </time>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-zinc-400 text-sm">Until Relay Closes</span>
          <time className="text-purple-400 font-mono font-bold text-lg" dateTime={relayCloseDate.toISOString()}>
            {timeUntilClose}
          </time>
        </div>
      </div>
    </div>
  );
});
