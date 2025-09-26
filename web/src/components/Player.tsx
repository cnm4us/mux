// Player.tsx
import * as React from "react";
import MuxPlayer, { type MuxPlayerProps } from "@mux/mux-player-react";

type Props = MuxPlayerProps & {
    /** turn analytics on; default false disables litix + cookies */
    analytics?: boolean;
};

const Player = React.forwardRef<React.ComponentRef<typeof MuxPlayer>, Props>(
    ({ analytics = false, ...props }, ref) => {
        const disable = !analytics;
        return (
            <MuxPlayer
                ref={ref}
                disableTracking={disable}
                disableCookies={disable}
                {...props}
            />
        );
    }
);

Player.displayName = "Player";
export default Player;
