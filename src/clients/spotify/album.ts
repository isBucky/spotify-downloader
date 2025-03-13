// Types
import type { SpotifyClient } from '.';
import type { AlbumInfo, SpotifyResponse } from '../../../types/client-spotify';
import type { PlaylistResult } from './playlist';

export class SpotifyAlbum {
    constructor(private client: SpotifyClient) {}

    public get rest() {
        return this.client.rest;
    }

    /**
     * Gets information about an album by its ID.
     *
     * @param albumId The album ID.
     * @returns An object with the album information.
     */
    public async get(albumId: string) {
        if (!this.client.started) throw new Error('The Spotify client has not been started');

        try {
            const request = await this.rest
                .albums(albumId, {
                    fields: 'id,name,type,total_tracks,tracks.items(id,name,href,type,artists(id,name,href))',
                })
                .get();

            const album = <SpotifyResponse<AlbumInfo>>await request.json();
            if (album.error) return this.client.parseError(album.error);

            return {
                id: album.id,
                name: album.name,
                type: album.type,
                totalTracks: album.total_tracks,
                tracks: this.client.parseTracks(album.tracks.items),
            };
        } catch (error) {
            throw new Error('Error getting album tracks', { cause: error });
        }
    }

    /**
     * Gets the tracks of an album, with pagination.
     *
     * @param albumId The album ID.
     * @param offset The offset for the pagination. Default: 0.
     */
    public async tracks(albumId: string, offset = 0) {
        if (!this.client.started) throw new Error('The Spotify client has not been started');

        try {
            const request = await this.rest
                .albums(albumId)
                .tracks({
                    fields: [
                        'total',
                        'offset',
                        'next',
                        'items.id',
                        'items.name',
                        'items.href',
                        'items.type',
                        'items.artists.id',
                        'items.artists.name',
                        'items.artists.href',
                    ].join(','),
                    limit: 10,
                    offset: offset,
                })
                .get();

            const album = await request.json();
            if (album.error) return this.client.parseError(album.error);

            return {
                total: album.total,
                length: album.items.length,
                offset: album.offset,
                next: offset + 10 > album.total ? null : offset + 10,
                tracks: this.client.parseTracks(album.items.map((t: any) => t)),
            } as PlaylistResult;
        } catch (error) {
            throw new Error('Error getting album', { cause: error });
        }
    }
}
