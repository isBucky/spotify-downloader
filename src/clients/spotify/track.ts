import type { SpotifyClient } from '.';
import type { SpotifyResponse, TrackInfo } from '../../../types/client-spotify';

export class SpotifyTrack {
    constructor(private client: SpotifyClient) {}

    public get rest() {
        return this.client.rest;
    }

    /**
     * Gets information about a track by its ID.
     *
     * @param trackId The track ID.
     * @returns An object with the track information.
     */
    public async get(trackId: string) {
        if (!this.client.started) throw new Error('The Spotify client has not been started');

        try {
            const request = await this.rest.tracks(trackId).get();

            const track = <SpotifyResponse<TrackInfo>>await request.json();
            if (track.error) return this.client.parseError(track.error);

            return track;
        } catch (error) {
            throw new Error('Error getting track', { cause: error });
        }
    }
}
