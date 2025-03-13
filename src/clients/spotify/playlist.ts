import type { PlaylistInfo, SpotifyResponse, TrackInfo } from '../../../types/client-spotify';
import type { SpotifyClient } from '.';

export class SpotifyPlaylist {
    constructor(private client: SpotifyClient) {}

    public get rest() {
        return this.client.rest;
    }

    /**
     * Gets information about a playlist by its ID.
     *
     * @param playlistId The playlist ID.
     * @returns An object with the playlist information.
     */
    public async get(playlistId: string) {
        if (!this.client.started) throw new Error('The Spotify client has not been started');

        try {
            const request = await this.rest
                .playlists(playlistId, {
                    fields: 'id,name,type,public,tracks.total,tracks.items(track(id,name,href,type,artists(id,name,href)))',
                })
                .get();

            const playlist = <SpotifyResponse<PlaylistInfo>>await request.json();
            if (playlist.error) return this.client.parseError(playlist.error);

            return {
                id: playlist.id,
                name: playlist.name,
                type: playlist.type,
                public: playlist.public,
                totalTracks: playlist.tracks.total,
                tracks: this.client.parseTracks(playlist.tracks.items.map((t) => t.track)),
            };
        } catch (error) {
            throw new Error('Error getting playlist', { cause: error });
        }
    }

    /**
     * Gets the tracks of a playlist, with pagination.
     *
     * @param playlistId The playlist ID.
     * @param offset The offset for the pagination. Default: 0.
     */
    public async tracks(playlistId: string, offset = 0) {
        if (!this.client.started) throw new Error('The Spotify client has not been started');

        try {
            const request = await this.rest
                .playlists(playlistId)
                .tracks({
                    fields: 'total,offset,next,items(track(id,name,href,type,artists(id,name,href)))',
                    limit: 10,
                    offset: offset,
                })
                .get();

            const playlist = await request.json();
            if (playlist.error) return this.client.parseError(playlist.error);

            return {
                total: playlist.total,
                length: playlist.items.length,
                offset: playlist.offset,
                next: offset + 10 > playlist.total ? null : offset + 10,
                tracks: this.client.parseTracks(playlist.items.map((t: any) => t.track)),
            } as PlaylistResult;
        } catch (error) {
            throw new Error('Error getting playlist tracks', { cause: error });
        }
    }
}

export interface PlaylistResult {
    total: number;
    length: number;
    offset: number;
    next: number | null;
    tracks: TrackInfo[];
}
