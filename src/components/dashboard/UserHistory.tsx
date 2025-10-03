import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { 
  History, 
  Camera, 
  Search, 
  Calendar,
  Download,
  Trash2,
  Eye,
  Clock,
  Pill,
  Activity
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface HistoryItem {
  id: string;
  type: 'medicine' | 'symptom';
  title: string;
  date: string;
  confidence?: number;
  status: 'completed' | 'pending' | 'failed';
  details: any;
}

interface UserHistoryProps {
  user: any;
}

export const UserHistory = ({ user }: UserHistoryProps) => {
  const [selectedTab, setSelectedTab] = useState("all");
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteType, setDeleteType] = useState<'selected' | 'all'>('selected');

  useEffect(() => {
    loadHistory();
  }, [user]);

  const loadHistory = async () => {
    try {
      // Load medicine scans
      const { data: medicineScans, error: medicineError } = await supabase
        .from('medicine_scans')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (medicineError) throw medicineError;

      // Load symptom analyses
      const { data: symptomAnalyses, error: symptomError } = await supabase
        .from('symptom_analyses')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (symptomError) throw symptomError;

      // Convert to HistoryItem format
      const medicineItems: HistoryItem[] = (medicineScans || []).map(scan => ({
        id: scan.id,
        type: 'medicine',
        title: scan.medicine_name || 'Medicine Scan',
        date: scan.created_at,
        confidence: Math.round((scan.confidence_score || 0) * 100),
        status: 'completed',
        details: {
          manufacturer: scan.manufacturer,
          uses: scan.uses ? scan.uses.split(', ') : []
        }
      }));

      const symptomItems: HistoryItem[] = (symptomAnalyses || []).map(analysis => ({
        id: analysis.id,
        type: 'symptom',
        title: 'Symptom Analysis',
        date: analysis.created_at,
        status: 'completed',
        details: {
          symptoms: analysis.symptoms || [],
          topCondition: analysis.possible_conditions?.[0]?.name || 'Unknown'
        }
      }));

      const allItems = [...medicineItems, ...symptomItems]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setHistoryItems(allItems);
    } catch (error: any) {
      toast(`Failed to load history: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const toggleItemSelection = (id: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedItems(newSelected);
  };

  const deleteSelected = async () => {
    try {
      const itemsToDelete = Array.from(selectedItems);
      
      for (const id of itemsToDelete) {
        const item = historyItems.find(i => i.id === id);
        if (item) {
          const table = item.type === 'medicine' ? 'medicine_scans' : 'symptom_analyses';
          await supabase.from(table).delete().eq('id', id);
        }
      }

      setHistoryItems(prev => prev.filter(item => !selectedItems.has(item.id)));
      setSelectedItems(new Set());
      toast("Selected items deleted successfully");
    } catch (error: any) {
      toast(`Failed to delete items: ${error.message}`);
    }
    setShowDeleteDialog(false);
  };

  const deleteAll = async () => {
    try {
      await supabase.from('medicine_scans').delete().eq('user_id', user.id);
      await supabase.from('symptom_analyses').delete().eq('user_id', user.id);

      setHistoryItems([]);
      setSelectedItems(new Set());
      toast("All history deleted successfully");
    } catch (error: any) {
      toast(`Failed to delete all history: ${error.message}`);
    }
    setShowDeleteDialog(false);
  };

  const handleDelete = () => {
    if (deleteType === 'selected') {
      deleteSelected();
    } else {
      deleteAll();
    }
  };

  const filteredItems = selectedTab === "all" 
    ? historyItems 
    : historyItems.filter(item => item.type === selectedTab);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeIcon = (type: string) => {
    return type === 'medicine' ? Camera : Search;
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent mb-2">
          Health History
        </h2>
        <p className="text-muted-foreground">
          Track your medicine scans and symptom analyses over time
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-primary/10 shadow-[var(--shadow-card)]">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                <Activity className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium">Total Scans</p>
                <p className="text-xl font-bold text-blue-600">{historyItems.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-primary/10 shadow-[var(--shadow-card)]">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center">
                <Pill className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium">Medicines</p>
                <p className="text-xl font-bold text-green-600">
                  {historyItems.filter(item => item.type === 'medicine').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-primary/10 shadow-[var(--shadow-card)]">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <div className="h-8 w-8 bg-purple-100 rounded-full flex items-center justify-center">
                <Search className="h-4 w-4 text-purple-600" />
              </div>
              <div>
                <p className="text-sm font-medium">Symptoms</p>
                <p className="text-xl font-bold text-purple-600">
                  {historyItems.filter(item => item.type === 'symptom').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-primary/10 shadow-[var(--shadow-card)]">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <div className="h-8 w-8 bg-orange-100 rounded-full flex items-center justify-center">
                <Clock className="h-4 w-4 text-orange-600" />
              </div>
              <div>
                <p className="text-sm font-medium">This Week</p>
                <p className="text-xl font-bold text-orange-600">3</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-primary/10 shadow-[var(--shadow-card)]">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5 text-primary" />
                Activity History
              </CardTitle>
              <CardDescription>
                Review your past medicine scans and symptom analyses
              </CardDescription>
            </div>
            <div className="flex gap-2">
              {selectedItems.size > 0 && (
                <Button 
                  variant="destructive" 
                  size="sm"
                  onClick={() => {
                    setDeleteType('selected');
                    setShowDeleteDialog(true);
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Selected ({selectedItems.size})
                </Button>
              )}
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  setDeleteType('all');
                  setShowDeleteDialog(true);
                }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete All
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-4">
            <TabsList className="grid grid-cols-3 w-full max-w-md">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="medicine">Medicines</TabsTrigger>
              <TabsTrigger value="symptom">Symptoms</TabsTrigger>
            </TabsList>

            <div className="space-y-4">
              {filteredItems.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No history items found</p>
                </div>
              ) : (
                filteredItems.map((item) => {
                  const IconComponent = getTypeIcon(item.type);
                  const { date, time } = formatDate(item.date);

                  return (
                    <Card key={item.id} className="border border-gray-200 hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start space-x-3">
                            <Checkbox 
                              checked={selectedItems.has(item.id)}
                              onCheckedChange={() => toggleItemSelection(item.id)}
                            />
                            <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                              item.type === 'medicine' ? 'bg-blue-100' : 'bg-purple-100'
                            }`}>
                              <IconComponent className={`h-5 w-5 ${
                                item.type === 'medicine' ? 'text-blue-600' : 'text-purple-600'
                              }`} />
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-medium text-foreground">{item.title}</h4>
                                <Badge className={getStatusColor(item.status)}>
                                  {item.status}
                                </Badge>
                                {item.confidence && (
                                  <Badge variant="outline">
                                    {item.confidence}% confidence
                                  </Badge>
                                )}
                              </div>
                              
                              <div className="text-sm text-muted-foreground mb-2">
                                {date} at {time}
                              </div>
                              
                              <div className="text-sm">
                                {item.type === 'medicine' ? (
                                  <div>
                                    {item.status === 'completed' ? (
                                      <>
                                        <p><strong>Manufacturer:</strong> {item.details.manufacturer}</p>
                                        <p><strong>Uses:</strong> {item.details.uses.join(", ")}</p>
                                      </>
                                    ) : item.status === 'failed' ? (
                                      <p className="text-red-600">Failed: {item.details.reason}</p>
                                    ) : null}
                                  </div>
                                ) : (
                                  <div>
                                    {item.status === 'completed' && (
                                      <>
                                        <p><strong>Symptoms:</strong> {item.details.symptoms.join(", ")}</p>
                                        <p><strong>Top Match:</strong> {item.details.topCondition}</p>
                                      </>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                          
                           <div className="flex items-center space-x-2">
                            <Button variant="ghost" size="sm">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </Tabs>
        </CardContent>
      </Card>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete History</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteType === 'selected' 
                ? `Are you sure you want to delete ${selectedItems.size} selected item(s)? This action cannot be undone.`
                : "Are you sure you want to delete ALL history? This action cannot be undone."
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};