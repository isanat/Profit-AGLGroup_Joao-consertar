import { useState } from "react";
import { useAdminBroadcastNotification } from "@workspace/api-client-react";
import { BroadcastNotificationInputType } from "@workspace/api-client-react/src/generated/api.schemas";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export default function AdminNotifications() {
  const broadcast = useAdminBroadcastNotification();
  
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState<BroadcastNotificationInputType>("info");
  const [targetIds, setTargetIds] = useState("");

  const handleBroadcast = () => {
    if (!title || !message) {
      toast.error("Title and message are required");
      return;
    }

    const ids = targetIds ? targetIds.split(",").map(id => parseInt(id.trim())).filter(id => !isNaN(id)) : null;

    broadcast.mutate({
      data: {
        title,
        message,
        type,
        targetUserIds: ids && ids.length > 0 ? ids : undefined
      }
    }, {
      onSuccess: () => {
        toast.success("Notification sent successfully");
        setTitle("");
        setMessage("");
        setTargetIds("");
      },
      onError: (err) => {
        toast.error(err.data?.error || "Failed to send notification");
      }
    });
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Broadcast Notifications</h2>
        <p className="text-muted-foreground">Send system messages to users.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Send Message</CardTitle>
          <CardDescription>Send a notification to all users or specific user IDs.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Title</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="System Update" />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Message</label>
            <Textarea 
              value={message} 
              onChange={(e) => setMessage(e.target.value)} 
              placeholder="We are updating our systems..."
              rows={4}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Type</label>
              <Select value={type} onValueChange={(val: any) => setType(val)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Target User IDs (Optional)</label>
              <Input 
                value={targetIds} 
                onChange={(e) => setTargetIds(e.target.value)} 
                placeholder="1, 2, 5 (Leave empty for all)" 
              />
            </div>
          </div>

          <Button 
            onClick={handleBroadcast} 
            disabled={broadcast.isPending || !title || !message}
            className="w-full mt-4"
          >
            {broadcast.isPending ? "Sending..." : "Send Notification"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
