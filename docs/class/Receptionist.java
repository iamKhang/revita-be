import java.util.List;

public class Receptionist {
    private String id;
    private String receptionistCode;
    private String authId;
    private boolean isActive;
    
    // Quan hệ nhiều-một
    private Auth auth;
    
    // Quan hệ một-nhiều
    private List<Counter> counters;
    private List<CounterAssignment> counterAssignments;
    
    public Receptionist() {
    }
}

