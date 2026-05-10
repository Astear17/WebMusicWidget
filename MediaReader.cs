using System;
using System.Threading;
using System.Threading.Tasks;
using Windows.Media.Control;

class Program
{
    static void Main()
    {
        Console.OutputEncoding = System.Text.Encoding.UTF8;
        RunAsync().GetAwaiter().GetResult();
    }

    static async Task RunAsync()
    {
        var sm = await GlobalSystemMediaTransportControlsSessionManager.RequestAsync();
        string lastMediaId = "";
        string currentThumbnail = "";
        
        while (true)
        {
            try
            {
                var session = sm.GetCurrentSession();
                if (session != null)
                {
                    var info = session.GetPlaybackInfo();
                    int state = 2; // Stopped
                    if (info.PlaybackStatus == GlobalSystemMediaTransportControlsSessionPlaybackStatus.Playing) state = 0;
                    else if (info.PlaybackStatus == GlobalSystemMediaTransportControlsSessionPlaybackStatus.Paused) state = 1;
                    
                    var mediaProps = await session.TryGetMediaPropertiesAsync();
                    string title = mediaProps.Title != null ? EscapeJson(mediaProps.Title) : "";
                    string artist = mediaProps.Artist != null ? EscapeJson(mediaProps.Artist) : "";
                    string album = mediaProps.AlbumTitle != null ? EscapeJson(mediaProps.AlbumTitle) : "";
                    
                    string mediaId = title + artist + album;
                    if (mediaId != lastMediaId)
                    {
                        lastMediaId = mediaId;
                        currentThumbnail = "";
                    }

                    // Retry thumbnail if we don't have it yet
                    if (string.IsNullOrEmpty(currentThumbnail) && mediaProps.Thumbnail != null)
                    {
                        try {
                            using (var stream = await mediaProps.Thumbnail.OpenReadAsync())
                            {
                                var bytes = new byte[stream.Size];
                                using (var reader = new Windows.Storage.Streams.DataReader(stream.GetInputStreamAt(0)))
                                {
                                    await reader.LoadAsync((uint)stream.Size);
                                    reader.ReadBytes(bytes);
                                    currentThumbnail = "data:image/png;base64," + Convert.ToBase64String(bytes);
                                }
                            }
                        } catch { /* Fallback to empty and retry next loop */ }
                    }

                    double position = 0;
                    double duration = 0;
                    var timeline = session.GetTimelineProperties();
                    if (timeline != null && timeline.EndTime.TotalSeconds > 0)
                    {
                        // Calculate precise current position using LastUpdatedTime
                        var now = DateTimeOffset.UtcNow;
                        var timeSinceUpdate = now - timeline.LastUpdatedTime;
                        
                        // Current position = reported position + (time since reported * rate)
                        double rate = info.PlaybackRate ?? 1.0;
                        if (info.PlaybackStatus != GlobalSystemMediaTransportControlsSessionPlaybackStatus.Playing) 
                            timeSinceUpdate = TimeSpan.Zero; // Don't advance if paused
                        
                        var currentPosSpan = timeline.Position + TimeSpan.FromTicks((long)(timeSinceUpdate.Ticks * rate));
                        
                        position = (currentPosSpan - timeline.StartTime).TotalSeconds;
                        duration = (timeline.EndTime - timeline.StartTime).TotalSeconds;
                        
                        // Clamp values
                        if (position > duration) position = duration;
                        if (position < 0) position = 0;
                    }

                    string json = string.Format(System.Globalization.CultureInfo.InvariantCulture,
                        "{{\"player\":\"{0}\", \"title\":\"{1}\", \"artist\":\"{2}\", \"album\":\"{3}\", \"state\":{4}, \"position\":{5}, \"duration\":{6}, \"coverSrc\":\"{7}\"}}",
                        EscapeJson(session.SourceAppUserModelId), title, artist, album, state, position, duration, currentThumbnail);
                    Console.WriteLine(json);
                    Console.Out.Flush();
                }
                else
                {
                    lastMediaId = "";
                    currentThumbnail = "";
                    Console.WriteLine(@"{""type"":""clear""}");
                    Console.Out.Flush();
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine(string.Format("{{\"type\":\"clear\",\"error\":\"{0}\"}}", EscapeJson(ex.Message)));
                Console.Out.Flush();
            }
            
            Thread.Sleep(500);
        }
    }
    
    static string EscapeJson(string s)
    {
        if (s == null) return "";
        return s.Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\n", "\\n").Replace("\r", "\\r");
    }
}
